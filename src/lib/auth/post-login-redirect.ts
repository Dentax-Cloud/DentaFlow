/**
 * Post-login routing (H3) — Node.js only, not for middleware.
 */
import { TenantStatus } from "@prisma/client";
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
  const memberships = await db.tenant_memberships.findMany({
    where: { userId: authUserId },
    include: {
      Tenant: {
        select: {
          id: true,
          slug: true,
          status: true,
          onboardingCompleted: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const isSuperAdmin = options?.isSuperAdmin ?? resolveIsSuperAdmin(authUserId);

  if (isSuperAdmin) {
    return { type: "superadmin", url: "/superadmin/tenants" };
  }

  if (memberships.length === 0) {
    return { type: "onboarding", url: "/sign-up" };
  }

  const activeMemberships = memberships.filter(
    (m) => m.Tenant.status === TenantStatus.ACTIVE,
  );
  const pendingOnly =
    activeMemberships.length === 0 &&
    memberships.some((m) => m.Tenant.status === TenantStatus.PENDING);

  if (pendingOnly) {
    return { type: "pending-approval", url: "/pending-approval" };
  }

  const usable = activeMemberships.length > 0 ? activeMemberships : memberships;

  if (options?.activeTenantId) {
    const preferred = usable.find((m) => m.tenantId === options.activeTenantId);
    if (preferred) {
      return {
        type: "tenant",
        url: `/t/${preferred.Tenant.slug}/dashboard`,
        tenantSlug: preferred.Tenant.slug,
      };
    }
  }

  if (usable.length === 1) {
    const m = usable[0]!;
    return {
      type: "tenant",
      url: `/t/${m.Tenant.slug}/dashboard`,
      tenantSlug: m.Tenant.slug,
    };
  }

  return { type: "select-org", url: "/select-org" };
}
