"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";
import { AuditAction } from "@prisma/client";

const supplierFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().max(200).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
});

function normalizeOptional(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function listSuppliers() {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.inventory.read);
  return db.supplier.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { items: true } },
    },
  });
}

export const createSupplier = createAction({
  schema: supplierFields,
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const email = normalizeOptional(input.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }
    const supplier = await db.supplier.create({
      data: {
        id: randomUUID(),
        tenantId: ctx.tenant.id,
        name: input.name,
        email,
        phone: normalizeOptional(input.phone),
        address: normalizeOptional(input.address),
      },
    });
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.staffMember?.id,
      action: AuditAction.CREATE,
      entity: "Supplier",
      entityId: supplier.id,
      metadata: { name: supplier.name },
    });
    revalidatePath("/inventory/suppliers");
    revalidatePath("/inventory");
    return supplier;
  },
});

export const updateSupplier = createAction({
  schema: supplierFields.extend({ id: z.string().min(1) }),
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const existing = await db.supplier.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Supplier not found");

    const email = normalizeOptional(input.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }

    const supplier = await db.supplier.update({
      where: { id: input.id },
      data: {
        name: input.name,
        email,
        phone: normalizeOptional(input.phone),
        address: normalizeOptional(input.address),
      },
    });
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.staffMember?.id,
      action: AuditAction.UPDATE,
      entity: "Supplier",
      entityId: supplier.id,
      metadata: { name: supplier.name },
    });
    revalidatePath("/inventory/suppliers");
    revalidatePath("/inventory");
    return supplier;
  },
});

export async function listSuppliersForSelect() {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.inventory.read);
  return db.supplier.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export const linkInventoryItemSupplier = createAction({
  schema: z.object({
    inventoryItemId: z.string().min(1),
    supplierId: z.string().nullable(),
  }),
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const item = await db.inventoryItem.findFirst({
      where: tenantWhere(ctx.tenant.id, {
        id: input.inventoryItemId,
        deletedAt: null,
      }),
    });
    if (!item) throw new Error("Inventory item not found");

    if (input.supplierId) {
      const supplier = await db.supplier.findFirst({
        where: tenantWhere(ctx.tenant.id, { id: input.supplierId }),
      });
      if (!supplier) throw new Error("Supplier not found");
    }

    const updated = await db.inventoryItem.update({
      where: { id: input.inventoryItemId },
      data: { supplierId: input.supplierId },
    });
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.staffMember?.id,
      action: AuditAction.UPDATE,
      entity: "InventoryItem",
      entityId: updated.id,
      metadata: { supplierId: input.supplierId },
    });
    revalidatePath(`/inventory/${input.inventoryItemId}`);
    revalidatePath("/inventory");
    revalidatePath("/inventory/suppliers");
    return { ok: true };
  },
});
