import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { isPublicPath } from "@/lib/auth/middleware-helpers";
import { isAnaesthesiaOrSedationCategory } from "@/lib/encounter/anaesthesia";
import {
  assertDistinctCosignProviders,
  canCosignAnaesthesia,
} from "@/lib/encounter/anaesthesia-cosign";
import { AnaesthesiaCosignError } from "@/lib/encounter/errors";
import {
  CONSENT_PURPOSE_CLINICAL,
  CONSENT_PURPOSE_MARKETING,
  consentItemsForVisitDisplay,
  filterPatientFacingShareablePhotos,
  hasActiveConsentForPurpose,
} from "@/lib/encounter/consent-purpose";
import { catchSpineExpectedFailure } from "@/lib/encounter/spine-action-result";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";

describe("Phase 3b anaesthesia catalog convention", () => {
  it("uses existing ANAESTHESIA category and accepts SEDATION / US spelling", () => {
    expect(isAnaesthesiaOrSedationCategory("ANAESTHESIA")).toBe(true);
    expect(isAnaesthesiaOrSedationCategory("anaesthesia")).toBe(true);
    expect(isAnaesthesiaOrSedationCategory("SEDATION")).toBe(true);
    expect(isAnaesthesiaOrSedationCategory("ANESTHESIA")).toBe(true);
    expect(isAnaesthesiaOrSedationCategory("RESTORATIVE")).toBe(false);
    expect(isAnaesthesiaOrSedationCategory(null)).toBe(false);
  });
});

describe("Phase 3b anaesthesia co-sign rules", () => {
  it("allows providers and clinic admins, not NURSE", () => {
    expect(canCosignAnaesthesia(UserRole.DOCTOR)).toBe(true);
    expect(canCosignAnaesthesia(UserRole.DENTIST)).toBe(true);
    expect(canCosignAnaesthesia(UserRole.OWNER)).toBe(true);
    expect(canCosignAnaesthesia(UserRole.NURSE)).toBe(false);
    expect(canCosignAnaesthesia(UserRole.RECEPTIONIST)).toBe(false);
    expect(canCosignAnaesthesia(null)).toBe(false);
  });

  it("rejects the same user attempting both signatures", () => {
    expect(() =>
      assertDistinctCosignProviders({
        actorStaffId: "staff_a",
        cosignStaffId: "staff_a",
      }),
    ).toThrow(AnaesthesiaCosignError);
    expect(() =>
      assertDistinctCosignProviders({
        actorStaffId: "staff_a",
        cosignStaffId: "staff_a",
      }),
    ).toThrow(/different provider/);
  });

  it("blocks completion when no second provider is present", () => {
    expect(() =>
      assertDistinctCosignProviders({
        actorStaffId: null,
        cosignStaffId: "staff_b",
      }),
    ).toThrow(/signed-in provider must log the completion/);
  });

  it("allows two distinct providers", () => {
    expect(() =>
      assertDistinctCosignProviders({
        actorStaffId: "staff_a",
        cosignStaffId: "staff_b",
      }),
    ).not.toThrow();
  });

  it("surfaces co-sign failures as expected spine action errors", () => {
    const result = catchSpineExpectedFailure(
      new AnaesthesiaCosignError("No second provider is available."),
    );
    expect(result).toEqual({
      ok: false,
      error: "No second provider is available.",
    });
  });
});

describe("Phase 3b consent-purpose enforcement", () => {
  it("treats clinical and marketing consent as non-interchangeable", () => {
    const marketingOnly = [
      { purpose: CONSENT_PURPOSE_MARKETING, revokedAt: null },
    ];
    const clinicalOnly = [
      { purpose: CONSENT_PURPOSE_CLINICAL, revokedAt: null },
    ];
    expect(hasActiveConsentForPurpose(marketingOnly, CONSENT_PURPOSE_CLINICAL)).toBe(
      false,
    );
    expect(hasActiveConsentForPurpose(clinicalOnly, CONSENT_PURPOSE_MARKETING)).toBe(
      false,
    );
    expect(hasActiveConsentForPurpose(clinicalOnly, CONSENT_PURPOSE_CLINICAL)).toBe(
      true,
    );
  });

  it("does not surface photos without active clinical consent, even if marked shareable", () => {
    const photos = [
      { id: "p1", patientShareable: true, type: "PHOTO" as const },
    ];
    expect(
      filterPatientFacingShareablePhotos(photos, { hasClinicalConsent: false }),
    ).toEqual([]);
    expect(
      filterPatientFacingShareablePhotos(photos, { hasClinicalConsent: true }),
    ).toEqual(photos);
  });

  it("does not surface unmarked photos even with clinical consent", () => {
    expect(
      filterPatientFacingShareablePhotos(
        [{ id: "p1", patientShareable: false, type: "PHOTO" }],
        { hasClinicalConsent: true },
      ),
    ).toEqual([]);
  });

  it("renders pending/granted consent items for the visit display", () => {
    expect(consentItemsForVisitDisplay([])).toEqual([
      { purpose: "clinical", status: "pending" },
      { purpose: "marketing", status: "pending" },
    ]);
    expect(
      consentItemsForVisitDisplay([
        { purpose: "clinical", revokedAt: null },
      ]),
    ).toEqual([
      { purpose: "clinical", status: "granted" },
      { purpose: "marketing", status: "pending" },
    ]);
  });
});

describe("Phase 3b public /visit route + flag-off", () => {
  it("treats /visit/[token] as a public path like /plan/[token]", () => {
    expect(isPublicPath("/visit/abc")).toBe(true);
    expect(isPublicPath("/plan/abc")).toBe(true);
  });

  it("keeps visit/co-sign behind ENCOUNTER_SPINE_ENABLED", () => {
    const prev = process.env.ENCOUNTER_SPINE_ENABLED;
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    expect(isEncounterSpineEnabled({ featureFlags: {} })).toBe(false);
    expect(
      isEncounterSpineEnabled({
        featureFlags: { ENCOUNTER_SPINE_ENABLED: true },
      }),
    ).toBe(true);
    if (prev === undefined) delete process.env.ENCOUNTER_SPINE_ENABLED;
    else process.env.ENCOUNTER_SPINE_ENABLED = prev;
  });

  it("wires visit-share and line-complete actions through requireSpineWrite", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/app/(dashboard)/features/clinical/encounter-spine-actions.ts",
      ),
      "utf8",
    );
    const visitFn = src.slice(src.indexOf("export async function createVisitShareLink"));
    expect(visitFn).toMatch(/await requireSpineWrite\(\)/);
    const transitionFn = src.slice(
      src.indexOf("export async function transitionSpineProcedureLine"),
    );
    expect(transitionFn).toMatch(/await requireSpineWrite\(\)/);
    expect(src).toMatch(/SPINE_DISABLED_MESSAGE/);
  });
});
