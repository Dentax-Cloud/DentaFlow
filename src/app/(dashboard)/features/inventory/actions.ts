"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction, StockTransactionType } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateStockRef } from "@/lib/ids/generate-ids";
import { STOCK_ADJUSTMENT_REASONS } from "@/lib/inventory/stock-adjustment";
import {
  STOCK_ISSUE_DESTINATION_TYPES,
  STOCK_ISSUE_REASONS,
} from "@/lib/inventory/stock-issue";

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
      userId: ctx.staffMember?.id,
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

const issueStockSchema = z.object({
  inventoryItemId: z.string().min(1),
  quantity: z.number().int().min(1),
  reason: z.enum(STOCK_ISSUE_REASONS),
  destinationType: z.enum(STOCK_ISSUE_DESTINATION_TYPES),
  /** Chair id or staff member id when destinationType is chair/staff. */
  destinationId: z.string().optional(),
  /** Free-text destination when type is other, or label override. */
  destinationLabel: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Formal Store issue — audited USAGE with destination + reason.
 * Distinct from quick removeStock (ad hoc, notes-only).
 * Does not touch spine MaterialUsage / procedure deduct paths.
 */
export const issueStock = createAction({
  schema: issueStockSchema,
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const item = await db.inventoryItem.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.inventoryItemId, deletedAt: null }),
    });
    if (!item) throw new Error("Inventory item not found");
    if (item.quantity < input.quantity) throw new Error("Insufficient stock");

    let chairId: string | null = null;
    let destinationLabel = input.destinationLabel?.trim() || "";

    if (input.destinationType === "chair") {
      if (!input.destinationId) throw new Error("Select a chair destination");
      const chair = await db.chair.findFirst({
        where: { id: input.destinationId, tenantId: ctx.tenant.id },
        select: { id: true, name: true, number: true },
      });
      if (!chair) throw new Error("Chair not found");
      chairId = chair.id;
      destinationLabel = destinationLabel || `Chair ${chair.number} (${chair.name})`;
    } else if (input.destinationType === "staff") {
      if (!input.destinationId) throw new Error("Select a staff destination");
      const staff = await db.staffMember.findFirst({
        where: { id: input.destinationId, tenantId: ctx.tenant.id, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (!staff) throw new Error("Staff member not found");
      destinationLabel =
        destinationLabel ||
        [staff.firstName, staff.lastName].filter(Boolean).join(" ") ||
        staff.email;
    } else if (!destinationLabel) {
      throw new Error("Enter a destination");
    }

    const transactionRef = await generateStockRef(ctx.tenant.id);
    const noteParts = [
      `issue:${input.reason}`,
      `to ${input.destinationType}:${destinationLabel}`,
      input.notes?.trim() || null,
    ].filter(Boolean);

    const [, stockTx] = await db.$transaction([
      db.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: { quantity: { decrement: input.quantity } },
      }),
      db.stockTransaction.create({
        data: {
          tenantId: ctx.tenant.id,
          itemId: input.inventoryItemId,
          type: StockTransactionType.USAGE,
          quantity: input.quantity,
          notes: noteParts.join(" · "),
          transactionRef,
          chairId,
        },
      }),
    ]);

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.staffMember?.id,
      action: AuditAction.UPDATE,
      entity: "InventoryItem",
      entityId: input.inventoryItemId,
      metadata: {
        kind: "stock_issue",
        reason: input.reason,
        destinationType: input.destinationType,
        destinationId: input.destinationId ?? null,
        destinationLabel,
        quantity: input.quantity,
        transactionRef,
        stockTransactionId: stockTx.id,
      },
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/chairs");
    revalidatePath(`/inventory/${input.inventoryItemId}`);
    return {
      ok: true as const,
      transactionRef,
      stockTransactionId: stockTx.id,
      destinationLabel,
    };
  },
});

export async function getStockHistory(itemId: string) {
  const ctx = await requireTenantContext();
  return db.stockTransaction.findMany({
    where: { tenantId: ctx.tenantId, itemId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
