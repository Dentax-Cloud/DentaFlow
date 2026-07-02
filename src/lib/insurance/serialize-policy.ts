import type { PatientInsurancePolicy, TenantInsuranceProvider } from "@prisma/client";
import {
  resolveEffectiveVerificationStatus,
  type SerializedInsurancePolicy,
  type SubscriberRelationship,
} from "./policy-types";

type PolicyWithProvider = PatientInsurancePolicy & {
  provider?: TenantInsuranceProvider | null;
};

export function serializeInsurancePolicy(
  policy: PolicyWithProvider,
  providerNameFallback?: string,
): SerializedInsurancePolicy {
  const providerDisplayName =
    policy.provider?.name ??
    policy.providerNameFreeText ??
    providerNameFallback ??
    "Unknown provider";

  const verificationStatus = resolveEffectiveVerificationStatus(
    policy.verificationStatus,
    policy.verificationExpiresAt,
  );

  return {
    id: policy.id,
    patientId: policy.patientId,
    rank: policy.rank,
    providerId: policy.providerId,
    providerNameFreeText: policy.providerNameFreeText,
    providerDisplayName,
    networkTier: policy.networkTier,
    memberId: policy.memberId,
    groupNumber: policy.groupNumber,
    subscriberName: policy.subscriberName,
    subscriberRelationship: policy.subscriberRelationship as SubscriberRelationship | null,
    effectiveDate: policy.effectiveDate?.toISOString() ?? null,
    expiryDate: policy.expiryDate?.toISOString() ?? null,
    cardFrontUrl: policy.cardFrontUrl,
    cardBackUrl: policy.cardBackUrl,
    verificationStatus: policy.verificationStatus as SerializedInsurancePolicy["verificationStatus"],
    effectiveVerificationStatus: verificationStatus,
    verifiedBy: policy.verifiedBy,
    verifiedAt: policy.verifiedAt?.toISOString() ?? null,
    verificationExpiresAt: policy.verificationExpiresAt?.toISOString() ?? null,
    isActive: policy.isActive,
  };
}
