"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createAction } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { checkBranchLimit } from "@/lib/features/gate";
import { canUseFeature } from "@/lib/features/plans";
import { tenantWhere } from "@/lib/tenant/scoped";

const branchSchema = z.object({
  name: z.string().min(1).trim(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const createBranch = createAction({
  schema: branchSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const branchCount = await db.branch.count({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
    });
    if (
      branchCount >= 1 &&
      !ctx.isSuperAdmin &&
      !canUseFeature(ctx.tenant.subscriptionPlan, "multiBranch")
    ) {
      throw new Error("FEATURE_NOT_AVAILABLE");
    }
    await checkBranchLimit(ctx.tenant.id);
    const branch = await db.branch.create({
      data: {
        tenantId: ctx.tenant.id,
        name: input.name,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        isPrimary: false,
      },
    });
    revalidatePath("/admin");
    return branch;
  },
});

export const updateBranch = createAction({
  schema: branchSchema.extend({ id: z.string() }),
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const existing = await db.branch.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id, deletedAt: null }),
    });
    if (!existing) throw new Error("Branch not found");

    const branch = await db.branch.update({
      where: { id: input.id },
      data: {
        name: input.name,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
      },
    });
    revalidatePath("/admin");
    return branch;
  },
});

export const deactivateBranch = createAction({
  schema: z.object({ id: z.string() }),
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    await db.branch.update({
      where: { id: input.id, tenantId: ctx.tenant.id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/admin");
    return { ok: true };
  },
});

export async function getBranches(tenantId: string) {
  const branches = await db.branch.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { chairs: true, appointments: true } },
    },
  });

  return branches.map((b) => ({
    ...b,
    staffCount: 0,
  }));
}

export async function getAuditLogs(
  tenantId: string,
  page = 1,
  filters?: { action?: string; userId?: string },
) {
  const take = 20;
  const skip = (page - 1) * take;

  return db.auditLog.findMany({
    where: {
      tenantId,
      ...(filters?.action ? { action: filters.action as never } : {}),
      ...(filters?.userId ? { userId: filters.userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
    include: { user: true },
  });
}

export async function countAuditLogs(tenantId: string) {
  return db.auditLog.count({ where: { tenantId } });
}
