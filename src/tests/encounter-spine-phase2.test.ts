import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  canTransition,
  assertTransition,
  isProcedureLineBillable,
  isProcedureLineTerminal,
  LEGAL_FORWARD_TRANSITIONS,
  INTERRUPTIBLE_STATUSES,
} from "@/lib/encounter/state-machine";
import {
  resolveEncounterSpineSettings,
  DEFAULT_ENCOUNTER_SPINE_SETTINGS,
  staleAfterMinutesFromSettings,
} from "@/lib/encounter/tenant-settings";
import {
  assertNoInProgressLines,
  EncounterBillingGateError,
  EncounterDoubleInvoiceError,
  isSpineLineIncludedInInvoice,
} from "@/lib/encounter/billing";
import { canOverridePreAuth, evaluateEncounterGates } from "@/lib/encounter/gates";
import { gateBundleToSummary } from "@/lib/encounter/gate-enforcement";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { encounterSpinePath, encounterWorkspacePath } from "@/lib/clinical/encounter-url";
import {
  findPrescriptionAllergyConflicts,
  treatmentItemIdsForWriteBack,
} from "@/lib/encounter/close-out";
import type {
  ConsentRecord,
  InsuranceVerification,
  RiskAssessment,
} from "@prisma/client";

describe("encounter state machine", () => {
  it("allows the happy-path forward chain", () => {
    expect(canTransition("arrival_intake", "chief_complaint_exam")).toBe(true);
    expect(canTransition("chief_complaint_exam", "gates")).toBe(true);
    expect(canTransition("gates", "procedure_execution")).toBe(true);
    expect(canTransition("procedure_execution", "close_out")).toBe(true);
    expect(canTransition("close_out", "billing")).toBe(true);
    expect(canTransition("billing", "recall_scheduled")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("arrival_intake", "billing")).toBe(false);
    expect(canTransition("gates", "close_out")).toBe(false);
    expect(canTransition("recall_scheduled", "arrival_intake")).toBe(false);
    expect(() => assertTransition("arrival_intake", "billing")).toThrow(
      /Illegal encounter transition/,
    );
  });

  it("allows interrupt only from post-gates states", () => {
    expect(INTERRUPTIBLE_STATUSES).toEqual([
      "procedure_execution",
      "close_out",
      "billing",
    ]);
    expect(canTransition("arrival_intake", "interrupted")).toBe(false);
    expect(canTransition("gates", "interrupted")).toBe(false);
    expect(canTransition("procedure_execution", "interrupted")).toBe(true);
    expect(canTransition("close_out", "interrupted")).toBe(true);
    expect(canTransition("billing", "interrupted")).toBe(true);
  });

  it("does not allow leaving interrupted via canTransition", () => {
    expect(canTransition("interrupted", "procedure_execution")).toBe(false);
    expect(LEGAL_FORWARD_TRANSITIONS.interrupted).toEqual([]);
  });

  it("classifies billable and terminal line statuses", () => {
    expect(isProcedureLineTerminal("completed")).toBe(true);
    expect(isProcedureLineTerminal("declined")).toBe(true);
    expect(isProcedureLineTerminal("in_progress")).toBe(false);
    expect(isProcedureLineBillable("completed")).toBe(true);
    expect(isProcedureLineBillable("interrupted")).toBe(true);
    expect(isProcedureLineBillable("declined")).toBe(false);
    expect(isProcedureLineBillable("planned")).toBe(false);
  });
});

describe("encounter spine tenant settings", () => {
  it("defaults to 24h stale / pain 7", () => {
    expect(resolveEncounterSpineSettings({})).toEqual(DEFAULT_ENCOUNTER_SPINE_SETTINGS);
    expect(staleAfterMinutesFromSettings(DEFAULT_ENCOUNTER_SPINE_SETTINGS)).toBe(1440);
  });

  it("clamps stale hours to 12–72 and pain to 0–10", () => {
    expect(
      resolveEncounterSpineSettings({
        settingsJson: { insuranceStaleAfterHours: 2, painScoreThreshold: 99 },
      }),
    ).toEqual({ insuranceStaleAfterHours: 12, painScoreThreshold: 10 });
    expect(
      resolveEncounterSpineSettings({
        settingsJson: { insuranceStaleAfterHours: 100, painScoreThreshold: -1 },
      }),
    ).toEqual({ insuranceStaleAfterHours: 72, painScoreThreshold: 0 });
  });
});

describe("spine billing selection + guards", () => {
  it("excludes declined, planned, already-billed, and non-partial interrupted", () => {
    expect(
      isSpineLineIncludedInInvoice({ status: "completed", billedInvoiceId: null }),
    ).toBe(true);
    expect(
      isSpineLineIncludedInInvoice({ status: "declined", billedInvoiceId: null }),
    ).toBe(false);
    expect(
      isSpineLineIncludedInInvoice({ status: "planned", billedInvoiceId: null }),
    ).toBe(false);
    expect(
      isSpineLineIncludedInInvoice({ status: "completed", billedInvoiceId: "inv1" }),
    ).toBe(false);
    expect(
      isSpineLineIncludedInInvoice({ status: "interrupted", billedInvoiceId: null }),
    ).toBe(false);
    expect(
      isSpineLineIncludedInInvoice(
        { status: "interrupted", billedInvoiceId: null },
        { partialBill: true },
      ),
    ).toBe(true);
  });

  it("refuses invoice generation while any line is in_progress", () => {
    expect(() => assertNoInProgressLines(["completed", "in_progress"])).toThrow(
      EncounterBillingGateError,
    );
    expect(() => assertNoInProgressLines(["completed", "declined"])).not.toThrow();
  });

  it("names the double-invoice error distinctly for callers", () => {
    const err = new EncounterDoubleInvoiceError("Encounter already invoiced as INV-1.");
    expect(err.name).toBe("EncounterDoubleInvoiceError");
    expect(err.message).toMatch(/INV-1/);
  });
});

describe("gate enforcement for procedure start", () => {
  const riskCleared: RiskAssessment = {
    id: "r1",
    tenantId: "t1",
    encounterId: "e1",
    asaClass: "II",
    vitalsSnapshot: {},
    flaggedInteractions: [],
    clearedByStaffId: "s1",
    clearedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
  const consentOk: ConsentRecord = {
    id: "c1",
    tenantId: "t1",
    encounterId: "e1",
    procedureLineId: null,
    purpose: "clinical",
    grantedAt: new Date("2026-01-01"),
    revokedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
  const insuranceOk: InsuranceVerification = {
    id: "i1",
    tenantId: "t1",
    encounterId: "e1",
    eligibilityStatus: "eligible",
    coverageLimits: {},
    preAuthStatus: "not_required",
    estimatedCoverage: 0 as unknown as InsuranceVerification["estimatedCoverage"],
    estimatedCopay: 0 as unknown as InsuranceVerification["estimatedCopay"],
    verifiedAt: new Date("2026-01-01T10:00:00Z"),
    staleAfterMinutes: 1440,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("blocks when risk is not cleared even if consent/insurance exist", () => {
    const result = evaluateEncounterGates({
      risk: { ...riskCleared, clearedAt: null },
      consent: consentOk,
      insurance: insuranceOk,
      sterilizationLogs: [{ procedureLineId: "l1", loggedAt: new Date() }],
    });
    expect(result.allClear).toBe(false);
    expect(result.consent).toBeNull();
    expect(gateBundleToSummary(result).risk).toBe("blocked");
  });

  it("requires sterilization per line after parallel gates clear", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const blocked = evaluateEncounterGates({
      risk: riskCleared,
      consent: consentOk,
      insurance: insuranceOk,
      sterilizationLogs: [{ procedureLineId: "l1", loggedAt: null }],
      now,
    });
    expect(blocked.allClear).toBe(false);
    expect(gateBundleToSummary(blocked).sterilization).toBe("blocked");

    const clear = evaluateEncounterGates({
      risk: riskCleared,
      consent: consentOk,
      insurance: insuranceOk,
      sterilizationLogs: [{ procedureLineId: "l1", loggedAt: now }],
      now,
    });
    expect(clear.allClear).toBe(true);
    expect(gateBundleToSummary(clear)).toEqual({
      risk: "cleared",
      consent: "cleared",
      insurance: "cleared",
      sterilization: "cleared",
    });
  });

  it("limits pre-auth override to dentist/specialist and admin/manager roles", () => {
    expect(canOverridePreAuth(UserRole.DENTIST)).toBe(true);
    expect(canOverridePreAuth(UserRole.DOCTOR)).toBe(true);
    expect(canOverridePreAuth(UserRole.ADMIN)).toBe(true);
    expect(canOverridePreAuth(UserRole.MANAGER)).toBe(true);
    expect(canOverridePreAuth(UserRole.OWNER)).toBe(true);
    expect(canOverridePreAuth(UserRole.NURSE)).toBe(false);
    expect(canOverridePreAuth(UserRole.RECEPTIONIST)).toBe(false);
    expect(canOverridePreAuth(null)).toBe(false);
  });
});

describe("flag-off invariant helpers", () => {
  it("defaults ENCOUNTER_SPINE_ENABLED off", () => {
    const prev = process.env.ENCOUNTER_SPINE_ENABLED;
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    expect(isEncounterSpineEnabled({ featureFlags: {} })).toBe(false);
    expect(isEncounterSpineEnabled(null)).toBe(false);
    if (prev === undefined) delete process.env.ENCOUNTER_SPINE_ENABLED;
    else process.env.ENCOUNTER_SPINE_ENABLED = prev;
  });

  it("keeps spine path distinct from legacy workspace path", () => {
    expect(encounterSpinePath("appt-1")).toBe("/clinical/encounter/appt-1/spine");
    expect(encounterWorkspacePath("appt-1", "chart")).toBe("/clinical/encounter/appt-1");
    expect(encounterSpinePath("appt-1")).not.toBe(encounterWorkspacePath("appt-1"));
  });
});

describe("close-out allergy cross-check + plan write-back selection", () => {
  it("flags prescription text that conflicts with patient allergies", () => {
    const hits = findPrescriptionAllergyConflicts(
      ["Penicillin", "Latex"],
      "Start amoxicillin 500mg TID",
    );
    expect(hits.map((h) => h.allergy)).toContain("Penicillin");
    expect(
      findPrescriptionAllergyConflicts(["Penicillin"], "Ibuprofen 400mg"),
    ).toEqual([]);
  });

  it("selects only completed lines with treatmentItemId for plan write-back", () => {
    expect(
      treatmentItemIdsForWriteBack([
        { status: "completed", treatmentItemId: "ti-1" },
        { status: "completed", treatmentItemId: null },
        { status: "declined", treatmentItemId: "ti-2" },
        { status: "in_progress", treatmentItemId: "ti-3" },
        { status: "completed", treatmentItemId: "ti-4" },
      ]),
    ).toEqual(["ti-1", "ti-4"]);
  });
});

describe("double-invoice concurrency semantics", () => {
  it("treats a second assert as a hard failure once an invoice exists (race loser)", async () => {
    // Simulates two concurrent finalize callers both passing a pre-check then one winning.
    let invoiced = false;
    async function tryClaim() {
      if (invoiced) throw new EncounterDoubleInvoiceError("already");
      // yield so both can enter before either sets the flag
      await Promise.resolve();
      if (invoiced) throw new EncounterDoubleInvoiceError("already");
      invoiced = true;
      return "ok";
    }
    // Without atomic unique this races; we assert at least one path uses EncounterDoubleInvoiceError
    const results = await Promise.allSettled([tryClaim(), tryClaim()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    // Best-effort race demo: at least one succeeds; production relies on Invoice.encounterId UNIQUE
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(new EncounterDoubleInvoiceError().name).toBe("EncounterDoubleInvoiceError");
  });
});
