"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, StockTransactionType } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { generateStockRef } from "@/lib/ids/generate-ids";

const addStockSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0).optional(),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
});

export const addStock = createAction({
  schema: addStockSchema,
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const item = await db.inventoryItem.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.inventoryItemId, deletedAt: null }),
    });
    if (!item) throw new Error("Inventory item not found");

    await db.inventoryItem.update({
      where: { id: input.inventoryItemId },
      data: {
        quantity: { increment: input.quantity },
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        ...(input.unitCost != null ? { cost: input.unitCost } : {}),
      },
    });

    await db.stockTransaction.create({
      data: {
        tenantId: ctx.tenant.id,
        itemId: input.inventoryItemId,
        type: StockTransactionType.PURCHASE,
        quantity: input.quantity,
        notes: input.notes,
      },
    });

    revalidatePath("/inventory");
    return { ok: true };
  },
});

const removeStockSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});

export const removeStock = createAction({
  schema: removeStockSchema,
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const item = await db.inventoryItem.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.inventoryItemId, deletedAt: null }),
    });
    if (!item) throw new Error("Inventory item not found");
    if (item.quantity < input.quantity) throw new Error("Insufficient stock");

    await db.inventoryItem.update({
      where: { id: input.inventoryItemId },
      data: { quantity: { decrement: input.quantity } },
    });

    await db.stockTransaction.create({
      data: {
        tenantId: ctx.tenant.id,
        itemId: input.inventoryItemId,
        type: StockTransactionType.USAGE,
        quantity: input.quantity,
        notes: input.notes,
      },
    });

    revalidatePath("/inventory");
    return { ok: true };
  },
});

/** Reason taxonomy for StockTransaction ADJUSTMENT writes. */
export const STOCK_ADJUSTMENT_REASONS = [
  "breakage",
  "wastage",
  "count-correction",
  "found-stock",
] as const;

export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];

const adjustStockSchema = z.object({
  inventoryItemId: z.string().min(1),
  /** Absolute on-hand quantity after the adjustment (physical count). */
  actualQuantity: z.number().int().min(0),
  reason: z.enum(STOCK_ADJUSTMENT_REASONS),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Reconcile InventoryItem.quantity to a physical count and write a real
 * StockTransaction with type ADJUSTMENT (not PURCHASE/USAGE).
 */
export const adjustStock = createAction({
  schema: adjustStockSchema,
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const item = await db.inventoryItem.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.inventoryItemId, deletedAt: null }),
    });
    if (!item) throw new Error("Inventory item not found");

    const previousQty = item.quantity;
    const delta = input.actualQuantity - previousQty;
    if (delta === 0) {
      return {
        ok: true as const,
        skipped: true as const,
        previousQty,
        actualQuantity: input.actualQuantity,
        delta: 0,
      };
    }

    const transactionRef = await generateStockRef(ctx.tenant.id);
    const noteParts = [
      input.reason,
      `expected ${previousQty} → actual ${input.actualQuantity} (Δ ${delta > 0 ? "+" : ""}${delta})`,
      input.notes?.trim() || null,
    ].filter(Boolean);

    const [, stockTx] = await db.$transaction([
      db.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: { quantity: input.actualQuantity },
      }),
      db.stockTransaction.create({
        data: {
          tenantId: ctx.tenant.id,
          itemId: input.inventoryItemId,
          type: StockTransactionType.ADJUSTMENT,
          quantity: Math.abs(delta),
          notes: noteParts.join(": "),
          transactionRef,
        },
      }),
    ]);

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.authUserId,
      action: AuditAction.UPDATE,
      entity: "InventoryItem",
      entityId: input.inventoryItemId,
      metadata: {
        kind: "stock_adjustment",
        reason: input.reason,
        previousQty,
        actualQuantity: input.actualQuantity,
        delta,
        transactionRef,
      },
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/count");
    revalidatePath(`/inventory/${input.inventoryItemId}`);
    return {
      ok: true as const,
      skipped: false as const,
      previousQty,
      actualQuantity: input.actualQuantity,
      delta,
      transactionRef,
      stockTransactionId: stockTx.id,
    };
  },
});

export async function getStockHistory(tenantId: string, itemId: string) {
  return db.stockTransaction.findMany({
    where: { tenantId, itemId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
