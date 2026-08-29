import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { buildSpineBillingPreview } from "@/lib/encounter/billing-preview";
import {
  consentItemsForVisitDisplay,
  filterPatientFacingShareablePhotos,
  hasActiveConsentForPurpose,
  CONSENT_PURPOSE_CLINICAL,
  type ConsentItemDisplay,
} from "@/lib/encounter/consent-purpose";
import type { SpineBillingPreview } from "@/lib/encounter/billing-preview";

export type VisitSharePayload = {
  tenant: {
    name: string;
    phone: string | null;
    email: string | null;
    currencySymbol: string;
  };
  patient: {
    firstName: string;
    lastName: string;
  };
  expiresOn: string;
  consentItems: ConsentItemDisplay[];
  estimate: SpineBillingPreview;
  photos: Array<{
    id: string;
    url: string;
    fileName: string | null;
    photoCategory: string | null;
    notes: string | null;
  }>;
};

function moneySymbol(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "AED";
}

/**
 * Resolve a public /visit/[token] payload.
 *
 * Isolation is proven by always loading the encounter with BOTH the share's
 * token-bound tenantId and encounterId — a token from tenant/patient A cannot
 * return tenant/patient B's rows.
 *
 * Returns null for missing, expired, flag-off, or mismatched encounter.
 */
export async function loadVisitSharePayload(
  token: string,
  now: Date = new Date(),
): Promise<VisitSharePayload | null> {
  if (!token || token.length < 16) return null;

  const share = await db.encounterVisitShare.findUnique({
    where: { token },
    select: {
      id: true,
      tenantId: true,
      encounterId: true,
      expiresAt: true,
      tenant: {
        select: {
          name: true,
          phone: true,
          email: true,
          currencySymbol: true,
          featureFlags: true,
        },
      },
    },
  });

  if (!share) return null;
  if (share.expiresAt < now) return null;
  if (!isEncounterSpineEnabled(share.tenant)) return null;

  const encounter = await db.encounter.findFirst({
    where: {
      id: share.encounterId,
      tenantId: share.tenantId,
      deletedAt: null,
    },
    select: {
      id: true,
      tenantId: true,
      patientId: true,
      interruptOutcome: true,
      patient: { select: { firstName: true, lastName: true } },
      consentRecords: {
        select: { purpose: true, revokedAt: true },
      },
      insuranceVerifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { estimatedCoverage: true, estimatedCopay: true },
      },
      procedureLines: {
        include: {
          procedureCatalog: { select: { code: true, name: true, price: true } },
          materialUsages: {
            include: { item: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!encounter) return null;

  const hasClinicalConsent = hasActiveConsentForPurpose(
    encounter.consentRecords,
    CONSENT_PURPOSE_CLINICAL,
  );

  const images = await db.clinicalImage.findMany({
    where: {
      tenantId: share.tenantId,
      patientId: encounter.patientId,
      type: "PHOTO",
      patientShareable: true,
    },
    select: {
      id: true,
      url: true,
      fileName: true,
      photoCategory: true,
      notes: true,
      type: true,
      patientShareable: true,
    },
    orderBy: { takenAt: "desc" },
    take: 24,
  });

  const photos = filterPatientFacingShareablePhotos(images, {
    hasClinicalConsent,
  }).map((img) => ({
    id: img.id,
    url: img.url,
    fileName: img.fileName,
    photoCategory: img.photoCategory,
    notes: img.notes,
  }));

  const estimate = buildSpineBillingPreview({
    lines: encounter.procedureLines.map((line) => {
      const catalog = serializeDecimal(line.procedureCatalog as Record<string, unknown>);
      return {
        id: line.id,
        status: line.status,
        billedInvoiceId: line.billedInvoiceId,
        unitPrice:
          line.unitPrice != null
            ? Number(serializeDecimal({ unitPrice: line.unitPrice }).unitPrice)
            : null,
        procedureCatalog: {
          code: line.procedureCatalog.code,
          name: line.procedureCatalog.name,
          price: Number(catalog.price ?? 0),
        },
        materialUsages: line.materialUsages.map((usage) => {
          const s = serializeDecimal(usage as Record<string, unknown>);
          return {
            quantity: Number(s.quantity ?? 0),
            unitCost: Number(s.unitCost ?? 0),
            itemName: usage.item?.name ?? null,
            isBillable: usage.isBillable !== false,
            status: usage.status,
          };
        }),
      };
    }),
    interruptOutcome: encounter.interruptOutcome,
    estimatedCoverage: encounter.insuranceVerifications[0]
      ? Number(
          serializeDecimal(
            encounter.insuranceVerifications[0] as Record<string, unknown>,
          ).estimatedCoverage ?? 0,
        )
      : 0,
    estimatedCopay: encounter.insuranceVerifications[0]
      ? Number(
          serializeDecimal(
            encounter.insuranceVerifications[0] as Record<string, unknown>,
          ).estimatedCopay ?? 0,
        )
      : 0,
  });

  await db.encounterVisitShare
    .update({
      where: { id: share.id, tenantId: share.tenantId },
      data: { viewedAt: now },
    })
    .catch(() => null);

  return {
    tenant: {
      name: share.tenant.name,
      phone: share.tenant.phone,
      email: share.tenant.email,
      currencySymbol: moneySymbol(share.tenant.currencySymbol),
    },
    patient: {
      firstName: encounter.patient.firstName,
      lastName: encounter.patient.lastName,
    },
    expiresOn: share.expiresAt.toISOString().slice(0, 10),
    consentItems: consentItemsForVisitDisplay(encounter.consentRecords),
    estimate,
    photos,
  };
}
