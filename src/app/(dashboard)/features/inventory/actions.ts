"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StockTransactionType } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";

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

export async function getStockHistory(tenantId: string, itemId: string) {
  return db.stockTransaction.findMany({
    where: { tenantId, itemId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
