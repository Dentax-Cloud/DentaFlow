import { describe, expect, it } from "vitest";
import { insuranceDraftFromVerification } from "@/lib/encounter/insurance-draft";

describe("insuranceDraftFromVerification", () => {
  it("falls back to EMPTY_DRAFT defaults when no verification exists", () => {
    expect(insuranceDraftFromVerification(null)).toEqual({
      insuranceEligibility: "eligible",
      insurancePreAuth: "not_required",
      estimatedCoverage: "",
      estimatedCopay: "",
    });
    expect(insuranceDraftFromVerification(undefined)).toEqual({
      insuranceEligibility: "eligible",
      insurancePreAuth: "not_required",
      estimatedCoverage: "",
      estimatedCopay: "",
    });
  });

  it("prefills from front-office InsuranceVerification non-default values", () => {
    expect(
      insuranceDraftFromVerification({
        eligibilityStatus: "unknown",
        preAuthStatus: "approved",
        estimatedCoverage: 850,
        estimatedCopay: 150,
      }),
    ).toEqual({
      insuranceEligibility: "unknown",
      insurancePreAuth: "approved",
      estimatedCoverage: "850",
      estimatedCopay: "150",
    });
  });
});
