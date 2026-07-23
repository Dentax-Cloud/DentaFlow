"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import {
  listProcedureBom,
  toBomQuantityDecimal,
  type ProcedureBomLine,
} from "@/lib/inventory/procedure-bom";

async function requireAdminWrite() {
  await requirePermission(PERMISSIONS.admin.write);
  return requireTenantContext();
}

async function requireAdminRead() {
  await requirePermission(PERMISSIONS.admin.read);
  return requireTenantContext();
}

export async function getProcedureBomAction(
  procedureCatalogId: string,
): Promise<ProcedureBomLine[]> {
  const ctx = await requireAdminRead();
  const proc = await db.procedureCatalog.findFirst({
    where: { id: procedureCatalogId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!proc) throw new Error("Procedure not found.");
  return listProcedureBom(ctx.tenantId, procedureCatalogId);
}

export async function listInventoryItemsForBom(): Promise<
  Array<{ id: string; name: string; sku: string; unit: string; quantity: number }>
> {
  const ctx = await requireAdminRead();
  const items = await db.inventoryItem.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, sku: true, unit: true, quantity: true },
  });
  return items;
}

export async function upsertProcedureBomItem(input: {
  procedureCatalogId: string;
  inventoryItemId: string;
  defaultQuantity: number;
  isOptional?: boolean;
  isBillable?: boolean;
}): Promise<ProcedureBomLine[]> {
  const ctx = await requireAdminWrite();

  const [proc, item] = await Promise.all([
    db.procedureCatalog.findFirst({
      where: { id: input.procedureCatalogId, tenantId: ctx.tenantId },
      select: { id: true },
    }),
    db.inventoryItem.findFirst({
      where: {
        id: input.inventoryItemId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);
  if (!proc) throw new Error("Procedure not found.");
  if (!item) throw new Error("Inventory item not found.");

  const qty = toBomQuantityDecimal(input.defaultQuantity);

  await db.procedureBomItem.upsert({
    where: {
      procedureCatalogId_inventoryItemId: {
        procedureCatalogId: input.procedureCatalogId,
        inventoryItemId: input.inventoryItemId,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      procedureCatalogId: input.procedureCatalogId,
      inventoryItemId: input.inventoryItemId,
      defaultQuantity: qty,
      isOptional: Boolean(input.isOptional),
      isBillable: Boolean(input.isBillable),
    },
    update: {
      defaultQuantity: qty,
      isOptional: Boolean(input.isOptional),
      isBillable: Boolean(input.isBillable),
    },
  });

  revalidatePath("/admin/procedure-catalog");
  return listProcedureBom(ctx.tenantId, input.procedureCatalogId);
}

export async function setProcedureBomItemBillable(input: {
  procedureCatalogId: string;
  bomItemId: string;
  isBillable: boolean;
}): Promise<ProcedureBomLine[]> {
  const ctx = await requireAdminWrite();
  const existing = await db.procedureBomItem.findFirst({
    where: {
      id: input.bomItemId,
      tenantId: ctx.tenantId,
      procedureCatalogId: input.procedureCatalogId,
    },
  });
  if (!existing) throw new Error("BOM item not found.");

  await db.procedureBomItem.update({
    where: { id: existing.id },
    data: { isBillable: Boolean(input.isBillable) },
  });

  revalidatePath("/admin/procedure-catalog");
  return listProcedureBom(ctx.tenantId, input.procedureCatalogId);
}

export async function removeProcedureBomItem(input: {
  procedureCatalogId: string;
  bomItemId: string;
}): Promise<ProcedureBomLine[]> {
  const ctx = await requireAdminWrite();
  const existing = await db.procedureBomItem.findFirst({
    where: {
      id: input.bomItemId,
      tenantId: ctx.tenantId,
      procedureCatalogId: input.procedureCatalogId,
    },
  });
  if (!existing) throw new Error("BOM item not found.");

  await db.procedureBomItem.delete({ where: { id: existing.id } });
  revalidatePath("/admin/procedure-catalog");
  return listProcedureBom(ctx.tenantId, input.procedureCatalogId);
}
