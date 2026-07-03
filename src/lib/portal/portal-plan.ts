import { canUseFeature } from "@/lib/features/plans";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";

export function tenantHasPatientPortalEntitlement(plan: SubscriptionPlan) {
  return canUseFeature(plan, "patientPortal");
}

export const PATIENT_PORTAL_PLAN_MESSAGE =
  "The patient portal is not included in this clinic's subscription plan. Please contact the clinic directly.";
