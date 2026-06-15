import type { Tenant } from "@prisma/client";
import { SubscriptionStatus } from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";

/** Default free-trial length for new clinics. */
export const TRIAL_DURATION_DAYS = 14;

type TrialTenantFields = Pick<
  Tenant,
  "trialEndsAt" | "subscriptionStatus" | "stripeSubscriptionId" | "subscriptionPlan"
>;

/** Compute trial end date from a start timestamp. */
export function computeTrialEndsAt(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DURATION_DAYS);
  return end;
}

/** Default subscription fields applied when a new tenant is provisioned. */
export function getDefaultTrialSubscriptionFields(createdAt: Date = new Date()) {
  return {
    subscriptionPlan: SubscriptionPlan.STARTER,
    subscriptionStatus: SubscriptionStatus.TRIALING,
    trialEndsAt: computeTrialEndsAt(createdAt),
  } as const;
}

/** Days left in trial (0 if expired, null if no trial end set). */
export function getTrialDaysRemaining(
  trialEndsAt: Date | null,
  now: Date = new Date(),
): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** True when the tenant has a paid Stripe subscription. */
export function hasPaidSubscription(
  tenant: Pick<Tenant, "stripeSubscriptionId">,
): boolean {
  return Boolean(tenant.stripeSubscriptionId);
}

/** True when the free trial window has ended and no paid subscription exists. */
export function isTrialExpired(tenant: TrialTenantFields, now: Date = new Date()): boolean {
  if (hasPaidSubscription(tenant)) return false;
  if (tenant.subscriptionStatus === SubscriptionStatus.EXPIRED) return true;
  if (!tenant.trialEndsAt) return false;
  return now > tenant.trialEndsAt;
}

/** True when tenant is on an active (non-expired) free trial. */
export function isTrialActive(tenant: TrialTenantFields, now: Date = new Date()): boolean {
  if (hasPaidSubscription(tenant)) return false;
  return (
    tenant.subscriptionStatus === SubscriptionStatus.TRIALING && !isTrialExpired(tenant, now)
  );
}

export type TenantTrialInfo = {
  trialEndsAt: Date | null;
  trialDaysRemaining: number | null;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  subscriptionPlan: Tenant["subscriptionPlan"];
  subscriptionStatus: Tenant["subscriptionStatus"];
};

/** Build trial summary for TenantContext consumers. */
export function getTenantTrialInfo(
  tenant: TrialTenantFields,
  now: Date = new Date(),
): TenantTrialInfo {
  const expired = isTrialExpired(tenant, now);
  return {
    trialEndsAt: tenant.trialEndsAt,
    trialDaysRemaining: getTrialDaysRemaining(tenant.trialEndsAt, now),
    isTrialActive: isTrialActive(tenant, now),
    isTrialExpired: expired,
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
  };
}

/** Whether lazy expiry should transition TRIALING → EXPIRED. */
export function shouldExpireTrial(tenant: TrialTenantFields, now: Date = new Date()): boolean {
  return (
    tenant.subscriptionStatus === SubscriptionStatus.TRIALING &&
    !hasPaidSubscription(tenant) &&
    tenant.trialEndsAt !== null &&
    now > tenant.trialEndsAt
  );
}
