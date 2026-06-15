import { SubscriptionStatus } from "@prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { isSuperAdmin } from "@/lib/tenant/config";
import { canUseFeature, type PlanFeatures } from "./plans";

const BLOCKED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.EXPIRED,
];

export async function requireActiveSubscription() {
  const ctx = await requireTenantContext();
  if (
    !ctx.isSuperAdmin &&
    BLOCKED_STATUSES.includes(ctx.tenant.subscriptionStatus)
  ) {
    throw new Error("SUBSCRIPTION_INACTIVE");
  }
  return ctx;
}

export async function requireFeature(feature: keyof PlanFeatures) {
  const ctx = await requireActiveSubscription();
  if (!ctx.isSuperAdmin && !canUseFeature(ctx.tenant.subscriptionPlan, feature)) {
    throw new Error("FEATURE_NOT_AVAILABLE");
  }
  return ctx;
}
