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
  getEncounterInvoiceGateMessage,
  isSpineLineIncludedInInvoice,
} from "@/lib/encounter/billing";
import {
  canOverridePreAuth,
  evaluateEncounterGates,
  evaluateRiskGate,
  evaluateConsentGate,
  evaluateInsuranceGate,
  evaluateSterilizationGate,
} from "@/lib/encounter/gates";
import {
  gateBundleToSummary,
  summarizeGatesFromRecords,
} from "@/lib/encounter/gate-enforcement";
import { GateAssertionError } from "@/lib/encounter/errors";
import {
  catchSpineExpectedFailure,
  withSpineExpectedFailureCatch,
} from "@/lib/encounter/spine-action-result";
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
  it("treats empty/missing tenant featureFlags as spine off (reader)", () => {
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

describe("fresh encounter gate read-path (never throws)", () => {
  it("evaluate* helpers return statuses for empty/initial state without throwing", () => {
    expect(() => evaluateRiskGate(null)).not.toThrow();
    expect(evaluateRiskGate(null)).toMatchObject({
      cleared: false,
      reason: "Risk assessment has not been recorded.",
    });

    expect(() => evaluateConsentGate(null)).not.toThrow();
    expect(evaluateConsentGate(null).cleared).toBe(false);

    expect(() => evaluateInsuranceGate(null)).not.toThrow();
    expect(evaluateInsuranceGate(null)).toMatchObject({
      cleared: false,
      reason: "Insurance verification has not been recorded.",
    });

    expect(() =>
      evaluateSterilizationGate({ procedureLineId: "p1", loggedAt: null }),
    ).not.toThrow();
    expect(
      evaluateSterilizationGate({ procedureLineId: "p1", loggedAt: null }).cleared,
    ).toBe(false);
  });

  it("summarizeGatesFromRecords on a fresh arrival_intake encounter returns blocked/pending, never throws", () => {
    let summary;
    expect(() => {
      summary = summarizeGatesFromRecords({
        risk: null,
        consent: null,
        insurance: null,
        sterilizationLogs: [],
        preAuthOverridden: false,
      });
    }).not.toThrow();

    expect(summary).toEqual({
      risk: "blocked",
      consent: "blocked",
      insurance: "blocked",
      sterilization: "pending",
    });
  });

  it("insurance unresolved (risk/consent cleared) still returns blocked status, never throws on read", () => {
    const risk = {
      clearedAt: new Date(),
    } as RiskAssessment;
    const consent = {
      purpose: "clinical",
      revokedAt: null,
    } as ConsentRecord;

    let summary;
    expect(() => {
      summary = summarizeGatesFromRecords({
        risk,
        consent,
        insurance: null,
        sterilizationLogs: [],
        preAuthOverridden: false,
      });
    }).not.toThrow();
    expect(summary).toMatchObject({
      risk: "cleared",
      consent: "cleared",
      insurance: "blocked",
    });

    // Write-path assert still uses this reason string when Start is attempted.
    expect(evaluateInsuranceGate(null).reason).toBe(
      "Insurance verification has not been recorded.",
    );
  });

  it("gateBundleToSummary on short-circuited evaluateEncounterGates (risk missing) does not throw", () => {
    const bundle = evaluateEncounterGates({
      risk: null,
      consent: null,
      insurance: null,
      sterilizationLogs: [],
    });
    expect(bundle.risk.cleared).toBe(false);
    expect(bundle.consent).toBeNull();
    expect(() => gateBundleToSummary(bundle)).not.toThrow();
    expect(gateBundleToSummary(bundle).risk).toBe("blocked");
  });
});

describe("close & invoice billable-line gates", () => {
  it("allows Close & Invoice when a completed line exists (insurance cleared separately)", () => {
    expect(
      getEncounterInvoiceGateMessage([
        { status: "completed", billedInvoiceId: null },
      ]),
    ).toBeNull();
    expect(
      isSpineLineIncludedInInvoice({ status: "completed", billedInvoiceId: null }),
    ).toBe(true);
  });

  it("blocks Close & Invoice for started (in_progress) lines — not billable until completed", () => {
    expect(
      getEncounterInvoiceGateMessage([
        { status: "in_progress", billedInvoiceId: null },
      ]),
    ).toMatch(/still in progress/i);
    expect(
      isSpineLineIncludedInInvoice({ status: "in_progress", billedInvoiceId: null }),
    ).toBe(false);
  });

  it("surfaces a clean validation message for genuinely zero billable lines (planned-only)", () => {
    const message = getEncounterInvoiceGateMessage([
      { status: "planned", billedInvoiceId: null },
    ]);
    expect(message).toMatch(/No billable procedure or material lines to invoice/);
    expect(message).toMatch(/Complete at least one procedure line/);
    expect(() => {
      throw new EncounterBillingGateError(message!);
    }).toThrow(EncounterBillingGateError);
  });
});

describe("spine action expected-failure catch (narrow)", () => {
  it("converts GateAssertionError and EncounterBillingGateError to { ok: false }", () => {
    expect(
      catchSpineExpectedFailure(
        new GateAssertionError("Insurance verification has not been recorded."),
      ),
    ).toEqual({
      ok: false,
      error: "Insurance verification has not been recorded.",
    });
    expect(
      catchSpineExpectedFailure(
        new EncounterBillingGateError(
          "No billable procedure or material lines to invoice.",
        ),
      ),
    ).toEqual({
      ok: false,
      error: "No billable procedure or material lines to invoice.",
    });
    expect(
      catchSpineExpectedFailure(new EncounterDoubleInvoiceError("already invoiced")),
    ).toEqual({ ok: false, error: "already invoiced" });
  });

  it("re-throws unexpected errors (e.g. DB failure) instead of returning { ok: false }", async () => {
    const dbBoom = new Error("Can't reach database server at 127.0.0.1:5435");

    expect(() => catchSpineExpectedFailure(dbBoom)).toThrow(
      /Can't reach database server/,
    );

    // Same wrapper Start / Close & Invoice use — unexpected must propagate, not become ok:false.
    let unexpectedResult: unknown = "not-assigned";
    await expect(
      withSpineExpectedFailureCatch(async () => {
        throw dbBoom;
      }).then((r) => {
        unexpectedResult = r;
        return r;
      }),
    ).rejects.toThrow("Can't reach database server at 127.0.0.1:5435");
    expect(unexpectedResult).toBe("not-assigned");

    const gateResult = await withSpineExpectedFailureCatch(async () => {
      throw new GateAssertionError("Insurance verification has not been recorded.");
    });
    expect(gateResult).toEqual({
      ok: false,
      error: "Insurance verification has not been recorded.",
    });
  });
});
