import { db } from "@/lib/db";
import { createClinicalAlertAudited } from "@/lib/encounter/repository";
import { NEAR_EXPIRY_DAYS } from "@/lib/inventory/lots";

export type MaterialExpirySyncResult = {
  scanned: number;
  created: number;
  skippedExisting: number;
};

/**
 * Create ClinicalAlert rows (type material_expiry) for ACTIVE batches within
 * the shared near-expiry window (NEAR_EXPIRY_DAYS / getExpiryAlerts default).
 * Dedupes on unacknowledged alerts with the same sourceRecordId (= batch id).
 */
export async function syncMaterialExpiryAlerts(params: {
  tenantId: string;
  userId?: string;
  /** Defaults to NEAR_EXPIRY_DAYS (30) — same window as /inventory/expiry default source. */
  daysAhead?: number;
}): Promise<MaterialExpirySyncResult> {
  const daysAhead = params.daysAhead ?? NEAR_EXPIRY_DAYS;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const batches = await db.inventoryBatch.findMany({
    where: {
      tenantId: params.tenantId,
      status: "ACTIVE",
      currentQty: { gt: 0 },
      expiryDate: { lte: cutoff },
    },
    select: {
      id: true,
      lotNumber: true,
      expiryDate: true,
      currentQty: true,
      item: { select: { id: true, name: true } },
    },
  });

  if (batches.length === 0) {
    return { scanned: 0, created: 0, skippedExisting: 0 };
  }

  const existing = await db.clinicalAlert.findMany({
    where: {
      tenantId: params.tenantId,
      type: "material_expiry",
      sourceRecordId: { in: batches.map((b) => b.id) },
      acknowledgedAt: null,
    },
    select: { sourceRecordId: true },
  });
  const alreadyAlerted = new Set(
    existing.map((a) => a.sourceRecordId).filter((id): id is string => Boolean(id)),
  );

  let created = 0;
  let skippedExisting = 0;

  for (const batch of batches) {
    if (alreadyAlerted.has(batch.id)) {
      skippedExisting++;
      continue;
    }

    await createClinicalAlertAudited(
      {
        tenant: { connect: { id: params.tenantId } },
        type: "material_expiry",
        sourceRecordId: batch.id,
      },
      { tenantId: params.tenantId, userId: params.userId },
    );
    created++;
  }

  return { scanned: batches.length, created, skippedExisting };
}
