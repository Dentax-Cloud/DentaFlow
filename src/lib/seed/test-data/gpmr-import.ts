import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { priceForCategory } from "./helpers";

const UNPRICED_DB_PRICE = 0;

type PackComplianceRules = { consentRequired?: boolean; xrayRequired?: boolean };
type PackInsuranceCodes = { requiresPreAuth?: boolean };

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Mirrors importFromGPMR server action — no auth context required. */
export async function importGpmrForTenant(
  tenantId: string,
  countryCode: string,
): Promise<{ imported: number; skipped: number }> {
  const gpmrProcs = await db.globalProcedure.findMany({
    where: { isActive: true },
    include: {
      countryPacks: { where: { countryCode, isActive: true } },
    },
    orderBy: [{ category: "asc" }, { canonicalName: "asc" }],
  });

  let imported = 0;
  let skipped = 0;

  for (const gpmr of gpmrProcs) {
    const existing = await db.procedureCatalog.findFirst({
      where: { tenantId, gpmrId: gpmr.id },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const pack = gpmr.countryPacks[0] ?? null;
    const gpmrNames = (gpmr.names ?? {}) as Record<string, string>;
    const localName =
      pack?.localName ||
      gpmrNames[`en-${countryCode}`] ||
      gpmrNames.en ||
      gpmr.canonicalName;
    const localCodes = (pack?.localCodes ?? {}) as Record<string, string>;
    const primaryCode =
      localCodes.DHA ||
      localCodes.CDT ||
      localCodes.NHS ||
      localCodes.CCHI ||
      localCodes.NPHIES ||
      gpmr.gpmrCode;
    const packCompliance = (pack?.complianceRules ?? {}) as PackComplianceRules;
    const packInsurance = (pack?.insuranceCodes ?? {}) as PackInsuranceCodes;

    await db.procedureCatalog.create({
      data: {
        id: randomUUID(),
        tenantId,
        gpmrId: gpmr.id,
        code: primaryCode,
        name: localName,
        nameAr: pack?.localNameAr ?? null,
        category: gpmr.category,
        duration: gpmr.defaultDurationMins,
        price: UNPRICED_DB_PRICE,
        costPrice: null,
        isActive: true,
        isOnlineBookable: false,
        requiresConsent: packCompliance.consentRequired === true,
        requiresXray: packCompliance.xrayRequired === true,
        requiresPreAuth: packInsurance.requiresPreAuth === true,
        sortOrder: imported,
      },
    });
    imported++;
  }

  return { imported, skipped };
}

export async function priceAllProceduresForTenant(
  tenantId: string,
  countryCode: string,
  rng: () => number,
): Promise<number> {
  const procedures = await db.procedureCatalog.findMany({
    where: { tenantId, isActive: true },
  });

  let updated = 0;
  for (const proc of procedures) {
    const selling = priceForCategory(countryCode, proc.category, rng);
    const cost = Math.round(selling * (0.35 + rng() * 0.15));
    await db.procedureCatalog.update({
      where: { id: proc.id },
      data: { price: selling, costPrice: cost },
    });
    updated++;
  }
  return updated;
}
