import { ENCOUNTER_SPINE_FLAG } from "@/lib/encounter/feature-flag";
import { HR_MODULE_FLAG } from "@/lib/hr/feature-flag";

/**
 * Default tenant.featureFlags applied at provision time.
 * Spine is on for every new clinic; existing tenants are flipped via DB rollout.
 * HR defaults OFF — enable per tenant via HR_MODULE_ENABLED for deliberate rollout.
 */
export const DEFAULT_TENANT_FEATURE_FLAGS: Readonly<Record<string, boolean>> = {
  [ENCOUNTER_SPINE_FLAG]: true,
  [HR_MODULE_FLAG]: false,
};
