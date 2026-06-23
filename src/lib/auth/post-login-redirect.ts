/**
 * Post-login routing (H3) — Node.js only, not for middleware.
 */
import { SubscriptionStatus, TenantStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveIsSuperAdmin } from "@/lib/auth";

export type PostLoginDestination =
  | { type: "superadmin"; url: "/superadmin/tenants" }
  | { type: "tenant"; url: string; tenantSlug: string }
  | { type: "select-org"; url: "/select-org" }
  | { type: "pending-approval"; url: "/pending-approval" }
  | { type: "onboarding"; url: "/sign-up" };

type ResolveOptions = {
  activeTenantId?: string | null;
  isSuperAdmin?: boolean;
};

export async function resolvePostLoginUrl(
  authUserId: string,
  options?: ResolveOptions,
): Promise<string> {
  const dest = await resolvePostLoginDestination(authUserId, options);
  return dest.url;
}

export async function resolvePostLoginDestination(
  authUserId: string,
  options?: ResolveOptions,
): Promise<PostLoginDestination> {
  const isSuperAdmin = options?.isSuperAdmin ?? resolveIsSuperAdmin(authUserId);

  if (isSuperAdmin) {
    return { type: "superadmin", url: "/superadmin/tenants" };
  }

  let activeTenantId = options?.activeTenantId ?? null;

  if (!activeTenantId) {
    const membership = await db.tenant_memberships.findFirst({
      where: { userId: authUserId, isActive: true },
      orderBy: { createdAt: "asc" },
      include: {
        Tenant: { select: { id: true, slug: true, status: true, subscriptionStatus: true } },
      },
    });

    if (!membership) {
      return { type: "onboarding", url: "/sign-up" };
    }

    activeTenantId = membership.tenantId;
    await db.auth_users.update({
      where: { id: authUserId },
      data: { activeTenantId: membership.tenantId },
    });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: activeTenantId },
    select: { id: true, slug: true, status: true, subscriptionStatus: true },
  });

  if (!tenant) {
    return { type: "select-org", url: "/select-org" };
  }

  if (tenant.status === TenantStatus.SUSPENDED || tenant.status === TenantStatus.CLOSED) {
    return { type: "pending-approval", url: "/pending-approval" };
  }

  if (tenant.subscriptionStatus === SubscriptionStatus.EXPIRED) {
    return {
      type: "tenant",
      url: "/billing/subscription",
      tenantSlug: tenant.slug,
    };
  }

  const membershipCount = await db.tenant_memberships.count({
    where: { userId: authUserId, isActive: true },
  });

  if (membershipCount > 1 && !options?.activeTenantId) {
    return { type: "select-org", url: "/select-org" };
  }

  return { type: "tenant", url: "/dashboard", tenantSlug: tenant.slug };
}
