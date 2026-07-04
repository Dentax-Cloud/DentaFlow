import { db } from "@/lib/db";

/** Lock chairside entries and linked tooth conditions when a session is finalized. */
export async function lockChartRecordsForSession(params: {
  tenantId: string;
  sessionId: string;
  appointmentId?: string | null;
}) {
  const now = new Date();

  const entries = await db.chairsideEntry.findMany({
    where: { sessionId: params.sessionId, tenantId: params.tenantId },
  });

  if (entries.length > 0) {
    await db.chairsideEntry.updateMany({
      where: { sessionId: params.sessionId, tenantId: params.tenantId, lockedAt: null },
      data: { lockedAt: now },
    });

    for (const entry of entries) {
      const versionCount = await db.chairsideEntryVersion.count({
        where: { entryId: entry.id },
      });
      if (versionCount === 0) {
        await db.chairsideEntryVersion.create({
          data: {
            entryId: entry.id,
            tenantId: params.tenantId,
            version: 1,
            toothNumber: entry.toothNumber,
            surface: entry.surface,
            procedureCode: entry.procedureCode,
            procedureName: entry.procedureName,
            conditionType: entry.conditionType,
            notes: entry.notes,
            unitPrice: entry.unitPrice,
            quantity: entry.quantity,
            includeInInvoice: entry.includeInInvoice,
          },
        });
      }
    }
  }

  if (params.appointmentId) {
    const conditions = await db.toothCondition.findMany({
      where: {
        tenantId: params.tenantId,
        appointmentId: params.appointmentId,
        lockedAt: null,
      },
    });

    if (conditions.length > 0) {
      await db.toothCondition.updateMany({
        where: {
          tenantId: params.tenantId,
          appointmentId: params.appointmentId,
          lockedAt: null,
        },
        data: { lockedAt: now },
      });

      for (const condition of conditions) {
        const versionCount = await db.toothConditionVersion.count({
          where: { conditionId: condition.id },
        });
        if (versionCount === 0) {
          await db.toothConditionVersion.create({
            data: {
              conditionId: condition.id,
              tenantId: params.tenantId,
              version: 1,
              type: condition.type,
              surfaces: condition.surfaces,
              severity: condition.severity,
              mobility: condition.mobility,
              pocketDepth: condition.pocketDepth,
              notes: condition.notes,
            },
          });
        }
      }
    }
  }
}

export async function amendLockedChairsideEntry(params: {
  tenantId: string;
  entryId: string;
  data: { notes?: string; quantity?: number; includeInInvoice?: boolean };
  amendedById?: string | null;
  amendedByName?: string | null;
  amendReason: string;
}) {
  const entry = await db.chairsideEntry.findFirst({
    where: { id: params.entryId, tenantId: params.tenantId },
  });
  if (!entry) throw new Error("Entry not found");
  if (!entry.lockedAt) {
    await db.chairsideEntry.update({
      where: { id: entry.id },
      data: params.data,
    });
    return;
  }

  const nextVersion =
    (await db.chairsideEntryVersion.count({ where: { entryId: entry.id } })) + 1;

  await db.chairsideEntryVersion.create({
    data: {
      entryId: entry.id,
      tenantId: params.tenantId,
      version: nextVersion,
      toothNumber: entry.toothNumber,
      surface: entry.surface,
      procedureCode: entry.procedureCode,
      procedureName: entry.procedureName,
      conditionType: entry.conditionType,
      notes: params.data.notes ?? entry.notes,
      unitPrice: entry.unitPrice,
      quantity: params.data.quantity ?? entry.quantity,
      includeInInvoice: params.data.includeInInvoice ?? entry.includeInInvoice,
      amendedById: params.amendedById ?? undefined,
      amendedByName: params.amendedByName ?? undefined,
      amendReason: params.amendReason,
    },
  });

  await db.chairsideEntry.update({
    where: { id: entry.id },
    data: params.data,
  });
}
