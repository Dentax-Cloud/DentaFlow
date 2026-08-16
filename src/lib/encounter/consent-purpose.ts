/** ConsentRecord.purpose values from the Phase 1 schema. */
export const CONSENT_PURPOSE_CLINICAL = "clinical" as const;
export const CONSENT_PURPOSE_MARKETING = "marketing" as const;

export type ConsentPurpose = typeof CONSENT_PURPOSE_CLINICAL | typeof CONSENT_PURPOSE_MARKETING;

export type ConsentPurposeRecord = {
  purpose: string;
  revokedAt?: Date | string | null;
};

export function hasActiveConsentForPurpose(
  records: ConsentPurposeRecord[] | null | undefined,
  purpose: ConsentPurpose,
): boolean {
  if (!records?.length) return false;
  return records.some((record) => record.purpose === purpose && !record.revokedAt);
}

/**
 * Patient-facing clinical display: marketing consent is never a substitute.
 * Photos must be explicitly marked shareable AND covered by active clinical consent.
 */
export function filterPatientFacingShareablePhotos<
  T extends { patientShareable?: boolean | null; type?: string | null },
>(
  photos: T[],
  opts: { hasClinicalConsent: boolean },
): T[] {
  if (!opts.hasClinicalConsent) return [];
  return photos.filter((photo) => {
    if (photo.patientShareable !== true) return false;
    if (photo.type && photo.type !== "PHOTO") return false;
    return true;
  });
}

export type ConsentItemDisplay = {
  purpose: ConsentPurpose;
  status: "granted" | "pending";
};

export function consentItemsForVisitDisplay(
  records: ConsentPurposeRecord[] | null | undefined,
): ConsentItemDisplay[] {
  return [
    {
      purpose: CONSENT_PURPOSE_CLINICAL,
      status: hasActiveConsentForPurpose(records, CONSENT_PURPOSE_CLINICAL)
        ? "granted"
        : "pending",
    },
    {
      purpose: CONSENT_PURPOSE_MARKETING,
      status: hasActiveConsentForPurpose(records, CONSENT_PURPOSE_MARKETING)
        ? "granted"
        : "pending",
    },
  ];
}
