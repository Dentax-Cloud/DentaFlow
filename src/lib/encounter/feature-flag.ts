import type { Tenant } from "@prisma/client";

export const ENCOUNTER_SPINE_FLAG = "ENCOUNTER_SPINE_ENABLED" as const;

type FeatureFlagsBag = Record<string, unknown> | null | undefined;

function readTenantFlag(featureFlags: FeatureFlagsBag): boolean {
  if (!featureFlags || typeof featureFlags !== "object" || Array.isArray(featureFlags)) {
    return false;
  }
  const value = (featureFlags as Record<string, unknown>)[ENCOUNTER_SPINE_FLAG];
  return value === true || value === "true" || value === 1;
}

/**
 * Module 6 encounter spine.
 * New tenants get ENCOUNTER_SPINE_ENABLED=true at provision (see DEFAULT_TENANT_FEATURE_FLAGS).
 * Empty/missing featureFlags still read as OFF here — use the env override or set the tenant flag.
 */
export function isEncounterSpineEnabled(
  tenant?: Pick<Tenant, "featureFlags"> | null,
): boolean {
  if (process.env.ENCOUNTER_SPINE_ENABLED === "true") return true;
  if (tenant) return readTenantFlag(tenant.featureFlags as FeatureFlagsBag);
  return false;
}
