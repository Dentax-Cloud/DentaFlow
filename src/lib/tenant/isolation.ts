import { auth } from "@/lib/auth/stubs/server";
import { db } from "@/lib/db";
import type { Tenant } from "@prisma/client";
import { TenantStatus } from "@prisma/client";
import { tenantWhere } from "./scoped";
import { isSuperAdmin, tenantConfig } from "./config";

export function withTenantScope<T extends Record<string, unknown>>(
  tenantId: string,
  data: T,
): T & { tenantId: string } {
  return { ...data, tenantId };
}

export function enforceTenantIdInQueries<T extends { tenantId?: string }>(
  tenantId: string,
  where?: Omit<T, "tenantId">,
): T & { tenantId: string } {
  return tenantWhere(tenantId, where);
}

export async function getTenantFromClerkOrg(clerkOrgId: string) {
  return db.tenant.findUnique({ where: { clerkOrgId } });
}

export function validateTenantAccess(tenant: Tenant, clerkUserId: string) {
  if (tenant.deletedAt) throw new Error("TENANT_DELETED");
  if (tenant.status === TenantStatus.CLOSED) throw new Error("TENANT_CLOSED");
  if (tenant.status === TenantStatus.SUSPENDED) throw new Error("TENANT_SUSPENDED");
  if (tenant.status === TenantStatus.PENDING && !isSuperAdmin(clerkUserId)) {
    throw new Error("TENANT_PENDING_APPROVAL");
  }
}

export function getActiveTenantOrThrow(tenant: Tenant, clerkUserId: string): Tenant {
  validateTenantAccess(tenant, clerkUserId);
  if (tenant.status !== TenantStatus.ACTIVE && !isSuperAdmin(clerkUserId)) {
    throw new Error("TENANT_NOT_ACTIVE");
  }
  return tenant;
}

export async function requireSuperAdmin() {
  const { userId } = await auth();
  if (!userId || !isSuperAdmin(userId)) {
    throw new Error("FORBIDDEN");
  }
  return userId;
}

export function resolveInitialTenantStatus(): TenantStatus {
  return tenantConfig.approvalRequired ? TenantStatus.PENDING : TenantStatus.ACTIVE;
}
