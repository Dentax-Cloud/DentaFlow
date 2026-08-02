export type InsuranceDraftSeed = {
  insuranceEligibility: string;
  insurancePreAuth: string;
  estimatedCoverage: string;
  estimatedCopay: string;
};

const EMPTY_INSURANCE_DRAFT: InsuranceDraftSeed = {
  insuranceEligibility: "eligible",
  insurancePreAuth: "not_required",
  estimatedCoverage: "",
  estimatedCopay: "",
};

/** Seed editable insurance fields from server InsuranceVerification when present. */
export function insuranceDraftFromVerification(
  insurance:
    | {
        eligibilityStatus: string;
        preAuthStatus: string;
        estimatedCoverage: number;
        estimatedCopay: number;
      }
    | null
    | undefined,
): InsuranceDraftSeed {
  if (!insurance) return { ...EMPTY_INSURANCE_DRAFT };
  return {
    insuranceEligibility: insurance.eligibilityStatus,
    insurancePreAuth: insurance.preAuthStatus,
    estimatedCoverage: String(insurance.estimatedCoverage),
    estimatedCopay: String(insurance.estimatedCopay),
  };
}
