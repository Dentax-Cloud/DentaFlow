import type { Tenant } from "@prisma/client";
import { db } from "@/lib/db";

export type ClinicRegistrationStatus = {
  isComplete: boolean;
  tenant: Tenant | null;
};

/**
 * Node.js only — uses Prisma. Do not import from middleware.
 */
export async function getClinicRegistrationStatus(
  tenantId: string | null | undefined,
): Promise<ClinicRegistrationStatus> {
  if (!tenantId) {
    return { isComplete: false, tenant: null };
  }

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
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
  userId: string | null,
  orgId: string | null,
): Promise<string> {
  if (!userId) return "/login";
  if (orgId) return "/dashboard";

  const membership = await db.tenant_memberships.findFirst({
    where: { userId, isActive: true },
  });
  if (membership) return "/dashboard";

  return "/sign-up";
}
