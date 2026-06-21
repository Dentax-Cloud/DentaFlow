import type { Tenant } from "@prisma/client";
import { getTenantFromClerkOrg } from "@/lib/tenant/isolation";
import { resolvePostLoginUrl } from "@/lib/auth/post-login-redirect";

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
 * Post-auth redirect target (NextAuth-first).
 */
export async function resolvePostAuthDestination(
  userId: string,
  _orgId?: string | null | undefined,
): Promise<string> {
  if (!userId) return "/login";
  return resolvePostLoginUrl(userId);
}

/** @deprecated Clerk-era helper — prefer resolvePostLoginUrl */
export { userHasOrganizationMembership } from "@/lib/auth/registration-clerk";
