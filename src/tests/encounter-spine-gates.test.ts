import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  canOverridePreAuth,
  clampStaleAfterMinutes,
  evaluateConsentGate,
  evaluateEncounterGates,
  evaluateInsuranceGate,
  evaluateRiskGate,
  evaluateSterilizationGate,
  isVerificationStale,
  resolveInsuranceUiDisplay,
} from "@/lib/encounter/gates";
import { summarizeGatesFromRecords } from "@/lib/encounter/gate-enforcement";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import type {
  ConsentRecord,
  InsuranceVerification,
  RiskAssessment,
} from "@prisma/client";

function risk(partial: Partial<RiskAssessment>): RiskAssessment {
  return {
    id: "r1",
    tenantId: "t1",
    encounterId: "e1",
    asaClass: "II",
    vitalsSnapshot: {},
    flaggedInteractions: [],
    clearedByStaffId: null,
    clearedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...partial,
  };
}

function consent(partial: Partial<ConsentRecord>): ConsentRecord {
  return {
    id: "c1",
    tenantId: "t1",
    encounterId: "e1",
    procedureLineId: null,
    purpose: "clinical",
    grantedAt: new Date("2026-01-01"),
    revokedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...partial,
  };
}

function insurance(partial: Partial<InsuranceVerification>): InsuranceVerification {
  return {
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
    ...partial,
  };
}

describe("ENCOUNTER_SPINE_ENABLED flag", () => {
  it("reads empty/null tenant flags as off without env override", () => {
    const prev = process.env.ENCOUNTER_SPINE_ENABLED;
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    expect(isEncounterSpineEnabled({ featureFlags: {} })).toBe(false);
    expect(isEncounterSpineEnabled({ featureFlags: null })).toBe(false);
    if (prev === undefined) delete process.env.ENCOUNTER_SPINE_ENABLED;
    else process.env.ENCOUNTER_SPINE_ENABLED = prev;
  });

  it("honors tenant featureFlags", () => {
    const prev = process.env.ENCOUNTER_SPINE_ENABLED;
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    expect(
      isEncounterSpineEnabled({
        featureFlags: { ENCOUNTER_SPINE_ENABLED: true },
      }),
    ).toBe(true);
    if (prev === undefined) delete process.env.ENCOUNTER_SPINE_ENABLED;
    else process.env.ENCOUNTER_SPINE_ENABLED = prev;
  });
});

describe("encounter gates", () => {
  it("blocks parallel gates until risk clears", () => {
    const result = evaluateEncounterGates({
      risk: risk({}),
      consent: consent({}),
      insurance: insurance({}),
      sterilizationLogs: [{ procedureLineId: "p1", loggedAt: new Date() }],
    });
    expect(result.risk.cleared).toBe(false);
    expect(result.consent).toBeNull();
    expect(result.insurance).toBeNull();
    expect(result.allClear).toBe(false);
  });

  it("runs consent and insurance after risk, and checks sterilization per procedure", () => {
    const result = evaluateEncounterGates({
      risk: risk({ clearedAt: new Date(), clearedByStaffId: "s1" }),
      consent: consent({}),
      insurance: insurance({}),
      sterilizationLogs: [
        { procedureLineId: "p1", loggedAt: new Date() },
        { procedureLineId: "p2", loggedAt: null },
      ],
      now: new Date("2026-01-01T12:00:00Z"),
    });
    expect(result.risk.cleared).toBe(true);
    expect(result.consent?.cleared).toBe(true);
    expect(result.insurance?.cleared).toBe(true);
    expect(result.sterilization).toHaveLength(2);
    expect(result.sterilization[0]?.cleared).toBe(true);
    expect(result.sterilization[1]?.cleared).toBe(false);
    expect(result.allClear).toBe(false);
  });

  it("evaluateRiskGate / consent / sterilization helpers", () => {
    expect(evaluateRiskGate(null).cleared).toBe(false);
    expect(evaluateConsentGate(null).cleared).toBe(false);
    expect(
      evaluateSterilizationGate({ procedureLineId: "p", loggedAt: null }).cleared,
    ).toBe(false);
  });

  it("treats verification as stale outside window", () => {
    expect(clampStaleAfterMinutes(60)).toBe(12 * 60);
    expect(clampStaleAfterMinutes(99999)).toBe(72 * 60);
    const v = insurance({ verifiedAt: new Date("2026-01-01T00:00:00Z") });
    expect(isVerificationStale(v, new Date("2026-01-03T00:00:00Z"))).toBe(true);
    expect(
      evaluateInsuranceGate(v, { now: new Date("2026-01-03T00:00:00Z") }).cleared,
    ).toBe(false);
  });

  it("blocks denied pre-auth unless overridden", () => {
    const v = insurance({ preAuthStatus: "denied" });
    expect(evaluateInsuranceGate(v, { now: new Date("2026-01-01T12:00:00Z") }).cleared).toBe(
      false,
    );
    expect(
      evaluateInsuranceGate(v, {
        now: new Date("2026-01-01T12:00:00Z"),
        preAuthOverridden: true,
      }).cleared,
    ).toBe(true);
  });
});

describe("Gate Summary vs Running Total insurance chip", () => {
  it("agrees on blocked+stale for an eligible but stale verification (Harry Smith class)", () => {
    const now = new Date("2026-08-04T12:00:00Z");
    const v = insurance({
      eligibilityStatus: "eligible",
      preAuthStatus: "approved",
      verifiedAt: new Date("2026-07-23T14:06:23.236Z"),
      staleAfterMinutes: 1440,
    });

    const gateSummary = summarizeGatesFromRecords({
      risk: risk({ clearedAt: new Date(), clearedByStaffId: "s1" }),
      consent: consent({}),
      insurance: v,
      sterilizationLogs: [],
      preAuthOverridden: false,
      now,
    });
    const runningTotal = resolveInsuranceUiDisplay({
      verification: v,
      preAuthOverridden: false,
      now,
    });

    expect(gateSummary.insurance).toBe("blocked");
    expect(runningTotal.chipStatus).toBe(gateSummary.insurance);
    expect(runningTotal.reasonTag).toBe("stale");
  });

  it("agrees on cleared when verification is fresh and eligible", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const v = insurance({});
    const gateSummary = summarizeGatesFromRecords({
      risk: risk({ clearedAt: new Date(), clearedByStaffId: "s1" }),
      consent: consent({}),
      insurance: v,
      sterilizationLogs: [],
      now,
    });
    const runningTotal = resolveInsuranceUiDisplay({ verification: v, now });
    expect(gateSummary.insurance).toBe("cleared");
    expect(runningTotal.chipStatus).toBe(gateSummary.insurance);
    expect(runningTotal.reasonTag).toBeUndefined();
  });

  it("agrees on overridden when pre-auth override is set", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const v = insurance({ preAuthStatus: "denied" });
    const runningTotal = resolveInsuranceUiDisplay({
      verification: v,
      preAuthOverridden: true,
      now,
    });
    expect(runningTotal.chipStatus).toBe("overridden");
  });
});

describe("canOverridePreAuth", () => {
  it("allows dentist/admin/manager only", () => {
    expect(canOverridePreAuth(UserRole.DENTIST)).toBe(true);
    expect(canOverridePreAuth(UserRole.DOCTOR)).toBe(true);
    expect(canOverridePreAuth(UserRole.ADMIN)).toBe(true);
    expect(canOverridePreAuth(UserRole.MANAGER)).toBe(true);
    expect(canOverridePreAuth(UserRole.OWNER)).toBe(true);
    expect(canOverridePreAuth(UserRole.RECEPTIONIST)).toBe(false);
    expect(canOverridePreAuth(UserRole.NURSE)).toBe(false);
    expect(canOverridePreAuth(null)).toBe(false);
  });
});
