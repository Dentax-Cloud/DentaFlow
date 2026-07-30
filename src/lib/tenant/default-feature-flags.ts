import { ENCOUNTER_SPINE_FLAG } from "@/lib/encounter/feature-flag";

/**
 * Default tenant.featureFlags applied at provision time.
 * Spine is on for every new clinic; existing tenants are flipped via DB rollout.
 */
export const DEFAULT_TENANT_FEATURE_FLAGS: Readonly<Record<string, boolean>> = {
  [ENCOUNTER_SPINE_FLAG]: true,
};
