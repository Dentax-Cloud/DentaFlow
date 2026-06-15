import type { SubscriptionPlan } from "@/lib/subscription/plan-types";

export const PLAN_FEATURES = {
  STARTER: {
    maxPatients: 500,
    maxUsers: 3,
    aiEnabled: false,
    patientPortal: false,
    inventory: true,
    crm: false,
    multiBranch: false,
  },
  PROFESSIONAL: {
    maxPatients: 5000,
    maxUsers: 15,
    aiEnabled: true,
    patientPortal: true,
    inventory: true,
    crm: true,
    multiBranch: true,
  },
  ENTERPRISE: {
    maxPatients: -1,
    maxUsers: -1,
    aiEnabled: true,
    patientPortal: true,
    inventory: true,
    crm: true,
    multiBranch: true,
  },
} as const;

export type PlanFeatures = (typeof PLAN_FEATURES)[SubscriptionPlan];

export function getPlanFeatures(plan: SubscriptionPlan): PlanFeatures {
  return PLAN_FEATURES[plan];
}

export function canUseFeature(
  plan: SubscriptionPlan,
  feature: keyof PlanFeatures,
): boolean {
  const features = getPlanFeatures(plan);
  const value = features[feature];
  if (typeof value === "boolean") return value;
  return true;
}
