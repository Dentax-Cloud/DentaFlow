import { requireSuperAdmin as requireSuperAdminAuth } from "@/lib/auth";
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

export function validateTenantAccess(tenant: Tenant, authUserId: string) {
  if (tenant.deletedAt) throw new Error("TENANT_DELETED");
  if (tenant.status === TenantStatus.CLOSED) throw new Error("TENANT_CLOSED");
  if (tenant.status === TenantStatus.SUSPENDED) throw new Error("TENANT_SUSPENDED");
}

export function getActiveTenantOrThrow(tenant: Tenant, authUserId: string): Tenant {
  validateTenantAccess(tenant, authUserId);
  if (tenant.status !== TenantStatus.ACTIVE && !isSuperAdmin(authUserId)) {
    throw new Error("TENANT_NOT_ACTIVE");
  }
  return tenant;
}

export async function requireSuperAdmin() {
  return requireSuperAdminAuth();
}

export function resolveInitialTenantStatus(): TenantStatus {
  return TenantStatus.ACTIVE;
}
