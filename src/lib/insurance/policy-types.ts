export const INSURANCE_VERIFICATION_STATUSES = [
  "NOT_VERIFIED",
  "PENDING",
  "VERIFIED",
  "EXPIRED",
] as const;

export type InsuranceVerificationStatus = (typeof INSURANCE_VERIFICATION_STATUSES)[number];

export const POLICY_RANKS = ["PRIMARY", "SECONDARY"] as const;
export type PolicyRank = (typeof POLICY_RANKS)[number];

export const SUBSCRIBER_RELATIONSHIPS = ["SELF", "SPOUSE", "CHILD", "OTHER"] as const;
export type SubscriberRelationship = (typeof SUBSCRIBER_RELATIONSHIPS)[number];

/** Default verification validity — TODO: move to tenant Settings when insurance settings UI ships. */
export const DEFAULT_VERIFICATION_VALIDITY_DAYS = 90;

export type SerializedInsurancePolicy = {
  id: string;
  patientId: string;
  rank: PolicyRank;
  providerId: string | null;
  providerNameFreeText: string | null;
  providerDisplayName: string;
  networkTier: string | null;
  memberId: string;
  groupNumber: string | null;
  subscriberName: string | null;
  subscriberRelationship: SubscriberRelationship | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  cardFrontUrl: string | null;
  cardBackUrl: string | null;
  verificationStatus: InsuranceVerificationStatus;
  effectiveVerificationStatus: InsuranceVerificationStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationExpiresAt: string | null;
  isActive: boolean;
};

export function resolveEffectiveVerificationStatus(
  status: string,
  verificationExpiresAt?: Date | string | null,
): InsuranceVerificationStatus {
  if (status === "VERIFIED" && verificationExpiresAt) {
    const expires = new Date(verificationExpiresAt);
    if (!Number.isNaN(expires.getTime()) && expires < new Date()) {
      return "EXPIRED";
    }
  }
  if (INSURANCE_VERIFICATION_STATUSES.includes(status as InsuranceVerificationStatus)) {
    return status as InsuranceVerificationStatus;
  }
  return "NOT_VERIFIED";
}
