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

export async function getTenantFromClerkOrg(clerkOrgId: string) {
  return db.tenant.findUnique({ where: { clerkOrgId } });
}

export function validateTenantAccess(tenant: Tenant, clerkUserId: string) {
  if (tenant.deletedAt) throw new Error("TENANT_DELETED");
  if (tenant.status === TenantStatus.CLOSED) throw new Error("TENANT_CLOSED");
  if (tenant.status === TenantStatus.SUSPENDED) throw new Error("TENANT_SUSPENDED");
}

export function getActiveTenantOrThrow(tenant: Tenant, clerkUserId: string): Tenant {
  validateTenantAccess(tenant, clerkUserId);
  if (tenant.status !== TenantStatus.ACTIVE && !isSuperAdmin(clerkUserId)) {
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
