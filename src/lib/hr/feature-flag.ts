import type { Tenant } from "@prisma/client";

export const HR_MODULE_FLAG = "HR_MODULE_ENABLED" as const;

type FeatureFlagsBag = unknown;

function readTenantFlag(featureFlags: FeatureFlagsBag): boolean {
  if (!featureFlags || typeof featureFlags !== "object" || Array.isArray(featureFlags)) {
    return false;
  }
  return (featureFlags as Record<string, unknown>)[HR_MODULE_FLAG] === true;
}

/**
 * HR module opt-in. Defaults OFF for existing tenants; set tenant.featureFlags.HR_MODULE_ENABLED
 * or env HR_MODULE_ENABLED=true. New tenants can get it via DEFAULT_TENANT_FEATURE_FLAGS (off).
 */
export function isHrModuleEnabled(
  tenant?: Pick<Tenant, "featureFlags"> | null,
): boolean {
  if (process.env.HR_MODULE_ENABLED === "true") return true;
  if (tenant) return readTenantFlag(tenant.featureFlags as FeatureFlagsBag);
  return false;
}
