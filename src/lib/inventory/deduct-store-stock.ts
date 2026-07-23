import { AuditAction, Prisma, StockTransactionType } from "@prisma/client";
import { db } from "@/lib/db";
import { generateStockRef } from "@/lib/ids/generate-ids";
import { getDefaultStoreLocation } from "@/lib/inventory/locations";

export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK" as const;
  constructor(
    message: string,
    readonly details: {
      itemId: string;
      itemName: string;
      requested: number;
      available: number;
      locationId: string;
    },
  ) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

/** Whole units deducted from InventoryItem.quantity (Int). Fractional usage rounds up. */
export function stockUnitsFromUsageQuantity(quantity: number): number {
  if (!(quantity > 0) || !Number.isFinite(quantity)) {
    throw new Error("Quantity must be greater than zero.");
  }
  return Math.max(1, Math.ceil(quantity));
}

/**
 * Pure stock-check used by deduction and tests.
 * Blocks negative stock — never silently oversell.
 */
export function assertSufficientStoreStock(params: {
  itemName: string;
  itemId: string;
  available: number;
  requested: number;
  locationId: string;
}): void {
  if (params.available < params.requested) {
    throw new InsufficientStockError(
      `Insufficient stock for ${params.itemName}: need ${params.requested}, have ${params.available} at central store.`,
      {
        itemId: params.itemId,
        itemName: params.itemName,
        requested: params.requested,
        available: params.available,
        locationId: params.locationId,
      },
    );
  }
}

/**
 * Deduct stock from the tenant default store in one locked transaction,
 * create MaterialUsage + StockTransaction USAGE + audit.
 *
 * Insufficient stock → throws InsufficientStockError (no negative stock).
 */
export async function logMaterialUsageWithStoreDeduction(params: {
  tenantId: string;
  procedureLineId: string;
  itemId: string;
  tier: "tracked" | "consumable";
  quantity: number;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  userId?: string;
}) {
  const deductQty = stockUnitsFromUsageQuantity(params.quantity);

  // Resolve location + stock ref outside the inventory row lock to avoid
  // nested DailyCounter writes while FOR UPDATE is held.
  const location = await getDefaultStoreLocation(params.tenantId);
  const transactionRef = await generateStockRef(params.tenantId);

  return db.$transaction(async (tx) => {
    const line = await tx.encounterProcedureLine.findFirst({
      where: { id: params.procedureLineId, tenantId: params.tenantId },
      select: {
        id: true,
        encounterId: true,
        encounter: { select: { appointmentId: true, patientId: true } },
      },
    });
    if (!line) throw new Error("Procedure line not found.");

    if (params.tier === "tracked" && !params.lotNumber?.trim()) {
      throw new Error("Lot number is required for tracked materials.");
    }

    // Re-assert location still belongs to this tenant (tenant isolation).
    const ownedLocation = await tx.inventoryLocation.findFirst({
      where: { id: location.id, tenantId: params.tenantId },
    });
    if (!ownedLocation) throw new Error("Inventory location not found.");

    // Row lock — concurrent deductions serialize on this inventory item.
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        name: string;
        quantity: number;
        cost: Prisma.Decimal | null;
      }>
    >`
      SELECT id, name, quantity, cost
      FROM "InventoryItem"
      WHERE id = ${params.itemId}
        AND "tenantId" = ${params.tenantId}
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    const item = locked[0];
    if (!item) throw new Error("Inventory item not found.");

    assertSufficientStoreStock({
      itemId: item.id,
      itemName: item.name,
      available: item.quantity,
      requested: deductQty,
      locationId: ownedLocation.id,
    });

    const unitCost = item.cost ?? new Prisma.Decimal(0);

    const usage = await tx.materialUsage.create({
      data: {
        tenantId: params.tenantId,
        procedureLineId: line.id,
        itemId: item.id,
        locationId: ownedLocation.id,
        tier: params.tier,
        quantity: new Prisma.Decimal(params.quantity),
        unitCost,
        lotNumber: params.lotNumber?.trim() || null,
        expiryDate: params.expiryDate ?? null,
        deductedAt: new Date(),
      },
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: deductQty } },
    });

    const stockTx = await tx.stockTransaction.create({
      data: {
        tenantId: params.tenantId,
        itemId: item.id,
        locationId: ownedLocation.id,
        type: StockTransactionType.USAGE,
        quantity: deductQty,
        transactionRef,
        appointmentId: line.encounter.appointmentId,
        patientId: line.encounter.patientId,
        notes: `Spine material usage ${usage.id} (procedure line ${line.id})`,
      },
    });

    // Audit inside the same transaction so it rolls back with the deduction.
    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        performedById: params.userId,
        action: AuditAction.CREATE,
        entity: "MaterialUsage",
        entityId: usage.id,
        metadata: {
          procedureLineId: line.id,
          encounterId: line.encounterId,
          itemId: item.id,
          locationId: ownedLocation.id,
          locationType: ownedLocation.type,
          quantityLogged: params.quantity,
          quantityDeducted: deductQty,
          stockTransactionId: stockTx.id,
          tier: params.tier,
        },
      },
    });

    return usage;
  });
}
