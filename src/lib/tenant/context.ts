/** Node.js runtime only — consumed by layouts/pages that export `runtime = "nodejs"`. */
import { auth } from "@clerk/nextjs/server";
import type { Tenant, User } from "@prisma/client";
import { provisionTenantForSession, syncTrialExpiry } from "./service";
import { getActiveTenantOrThrow } from "./isolation";
import { isSuperAdmin } from "./config";
import { getTenantTrialInfo, type TenantTrialInfo } from "./trial";

export type { TenantTrialInfo };

export type TenantContext = {
  tenant: Tenant;
  user: User;
  clerkUserId: string;
  orgId: string;
  isSuperAdmin: boolean;
  /** Trial & subscription summary for the current tenant. */
  trial: TenantTrialInfo;
};

export async function getTenantContext(): Promise<TenantContext | null> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const { tenant: provisioned, user } = await provisionTenantForSession(userId, orgId);
  const tenant = await syncTrialExpiry(provisioned);

  return {
    tenant,
    user,
    clerkUserId: userId,
    orgId,
    isSuperAdmin: isSuperAdmin(userId),
    trial: getTenantTrialInfo(tenant),
  };
}

export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) {
    throw new Error("UNAUTHORIZED");
  }
  return ctx;
}

/**
 * Requires an ACTIVE tenant (or super-admin bypass for platform ops).
 */
export async function requireActiveTenantContext(): Promise<TenantContext> {
  const ctx = await requireTenantContext();
  getActiveTenantOrThrow(ctx.tenant, ctx.clerkUserId);
  return ctx;
}

/** Returns the signed-in tenant user including their RBAC role. */
export async function getUserWithRole() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  return {
    user: ctx.user,
    role: ctx.user.role,
    tenant: ctx.tenant,
    isSuperAdmin: ctx.isSuperAdmin,
  };
}
