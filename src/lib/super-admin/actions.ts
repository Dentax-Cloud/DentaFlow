"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { TenantStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenant/isolation";
import { logTenantAudit } from "@/lib/tenant/audit";
import type { ActionResult } from "@/lib/actions/safe-action";
import { actionError, actionSuccess } from "@/lib/actions/safe-action";

async function withSuperAdmin<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const userId = await requireSuperAdmin();
    const data = await fn(userId);
    revalidatePath("/super-admin");
    return actionSuccess(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "FORBIDDEN") return actionError("Super admin access required");
    console.error("[super-admin]", message);
    return actionError("Operation failed. Please try again.");
  }
}

export async function suspendTenantAction(input: { tenantId: string; reason?: string }) {
  return withSuperAdmin(async (userId) => {
    const tenant = await db.tenant.update({
      where: { id: input.tenantId },
      data: { status: TenantStatus.SUSPENDED },
    });
    await logTenantAudit({
      tenantId: tenant.id,
      userId,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { action: "suspend", reason: input.reason },
    });
    return tenant;
  });
}

export async function activateTenantAction(input: { tenantId: string }) {
  return withSuperAdmin(async (userId) => {
    const tenant = await db.tenant.update({
      where: { id: input.tenantId },
      data: { status: TenantStatus.ACTIVE },
    });
    await logTenantAudit({
      tenantId: tenant.id,
      userId,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { action: "activate" },
    });
    return tenant;
  });
}

export async function softDeleteTenantAction(input: { tenantId: string }) {
  return withSuperAdmin(async (userId) => {
    const tenant = await db.tenant.update({
      where: { id: input.tenantId },
      data: { deletedAt: new Date(), status: TenantStatus.CLOSED },
    });
    await logTenantAudit({
      tenantId: tenant.id,
      userId,
      action: "DELETE",
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { action: "soft_delete" },
    });
    return tenant;
  });
}

export async function bulkSuspendTenantsAction(input: { tenantIds: string[] }) {
  const schema = z.object({ tenantIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return actionError("Invalid tenant selection");

  return withSuperAdmin(async (userId) => {
    const result = await db.tenant.updateMany({
      where: { id: { in: parsed.data.tenantIds }, deletedAt: null },
      data: { status: TenantStatus.SUSPENDED },
    });
    for (const tenantId of parsed.data.tenantIds) {
      await logTenantAudit({
        tenantId,
        userId,
        action: "UPDATE",
        entity: "Tenant",
        entityId: tenantId,
        metadata: { action: "bulk_suspend" },
      });
    }
    return { count: result.count };
  });
}

export async function bulkActivateTenantsAction(input: { tenantIds: string[] }) {
  const schema = z.object({ tenantIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return actionError("Invalid tenant selection");

  return withSuperAdmin(async (userId) => {
    const result = await db.tenant.updateMany({
      where: { id: { in: parsed.data.tenantIds }, deletedAt: null },
      data: { status: TenantStatus.ACTIVE },
    });
    for (const tenantId of parsed.data.tenantIds) {
      await logTenantAudit({
        tenantId,
        userId,
        action: "UPDATE",
        entity: "Tenant",
        entityId: tenantId,
        metadata: { action: "bulk_activate" },
      });
    }
    return { count: result.count };
  });
}

/**
 * Switches super-admin active tenant and returns tenant id for client redirect.
 */
export async function impersonateTenantAction(input: { tenantId: string }) {
  return withSuperAdmin(async (userId) => {
    const tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant || tenant.deletedAt) throw new Error("Tenant not found");

    await db.auth_users.update({
      where: { id: userId },
      data: { activeTenantId: tenant.id },
    });

    await logTenantAudit({
      tenantId: tenant.id,
      userId,
      action: "LOGIN",
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { action: "impersonate" },
    });

    return { tenantId: tenant.id, tenantName: tenant.name };
  });
}
