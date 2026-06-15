import type { Tenant } from "@prisma/client";

export function requiresOnboarding(tenant: Tenant): boolean {
  return !tenant.onboardingCompleted;
}

export function getOnboardingRedirectPath(tenant: Tenant): string | null {
  if (requiresOnboarding(tenant)) return "/onboarding";
  return null;
}
