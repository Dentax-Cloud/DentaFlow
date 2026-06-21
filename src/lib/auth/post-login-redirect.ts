/**
 * Post-login routing (H3) — Node.js only, not for middleware.
 */
import { TenantRole, TenantStatus } from "@prisma/client";
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
  const memberships = await db.tenantMembership.findMany({
    where: { userId: authUserId },
    include: {
      tenant: {
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

  const membershipRole =
    memberships.find((m) => m.role === TenantRole.SUPERADMIN)?.role ?? memberships[0]?.role ?? null;

  const isSuperAdmin =
    options?.isSuperAdmin ?? resolveIsSuperAdmin(authUserId, membershipRole);

  if (isSuperAdmin) {
    return { type: "superadmin", url: "/superadmin/tenants" };
  }

  if (memberships.length === 0) {
    return { type: "onboarding", url: "/sign-up" };
  }

  const activeMemberships = memberships.filter(
    (m) => m.tenant.status === TenantStatus.ACTIVE,
  );
  const pendingOnly =
    activeMemberships.length === 0 &&
    memberships.some((m) => m.tenant.status === TenantStatus.PENDING);

  if (pendingOnly) {
    return { type: "pending-approval", url: "/pending-approval" };
  }

  const usable = activeMemberships.length > 0 ? activeMemberships : memberships;

  if (options?.activeTenantId) {
    const preferred = usable.find((m) => m.tenantId === options.activeTenantId);
    if (preferred) {
      return {
        type: "tenant",
        url: `/t/${preferred.tenant.slug}/dashboard`,
        tenantSlug: preferred.tenant.slug,
      };
    }
  }

  if (usable.length === 1) {
    const m = usable[0]!;
    return {
      type: "tenant",
      url: `/t/${m.tenant.slug}/dashboard`,
      tenantSlug: m.tenant.slug,
    };
  }

  return { type: "select-org", url: "/select-org" };
}
