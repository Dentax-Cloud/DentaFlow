import type { Tenant } from "@prisma/client";
import { userHasOrganizationMembership } from "@/lib/auth/registration-clerk";
import { getTenantFromClerkOrg } from "@/lib/tenant/isolation";
import { getTenantContext } from "@/lib/tenant/context";
import { getRoleHomePath } from "@/lib/rbac/routes";

export type ClinicRegistrationStatus = {
  isComplete: boolean;
  tenant: Tenant | null;
};

/**
 * Node.js only — uses Prisma. Do not import from middleware.
 */
export async function getClinicRegistrationStatus(
  orgId: string | null | undefined,
): Promise<ClinicRegistrationStatus> {
  if (!orgId) {
    return { isComplete: false, tenant: null };
  }

  const tenant = await getTenantFromClerkOrg(orgId);
  if (!tenant) {
    return { isComplete: false, tenant: null };
  }

  return {
    isComplete: tenant.onboardingCompleted,
    tenant,
  };
}

/**
 * Post-auth redirects for sign-in and protected app routes (Node.js server).
 * Do not use on the public landing page — `/` must stay accessible to everyone.
 */
export async function resolvePostAuthDestination(
  userId: string,
  orgId: string | null | undefined,
): Promise<string> {
  if (!orgId) {
    const hasMembership = await userHasOrganizationMembership(userId);
    return hasMembership ? "/select-org" : "/sign-up";
  }

  const { isComplete } = await getClinicRegistrationStatus(orgId);
  if (!isComplete) return "/sign-up";

  const ctx = await getTenantContext();
  if (ctx?.user.role) {
    return getRoleHomePath(ctx.user.role);
  }

  return "/dashboard";
}

export { userHasOrganizationMembership } from "@/lib/auth/registration-clerk";
