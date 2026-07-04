import { SubscriptionStatus, TenantStatus, type Tenant } from "@prisma/client";
import { canUseFeature, getPlanFeatures, type PlanFeatures } from "@/lib/features/plans";
import { parseMetadataForUpdate } from "@/lib/tenant/clinic-profile";
import { isTrialExpired } from "@/lib/tenant/trial";

export const NOT_PROVIDED = "Not provided";

const BLOCKED_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.EXPIRED,
];

export function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return NOT_PROVIDED;
  const s = String(value).trim();
  return s.length > 0 ? s : NOT_PROVIDED;
}

export function formatStructuredAddress(
  tenant: Pick<Tenant, "address" | "city" | "country">,
  metadata: ReturnType<typeof parseMetadataForUpdate>,
): string {
  const structured = [
    metadata.addressLine1,
    metadata.addressLine2,
    tenant.city,
    metadata.state,
    metadata.postalCode,
    tenant.country,
  ]
    .filter(Boolean)
    .join(", ");

  if (structured.trim()) return structured;
  if (tenant.address?.trim()) return tenant.address.trim();
  return NOT_PROVIDED;
}

export function isTenantAccessBlocked(
  tenant: Pick<
    Tenant,
    | "status"
    | "subscriptionStatus"
    | "trialEndsAt"
    | "stripeSubscriptionId"
    | "subscriptionPlan"
  >,
): boolean {
  if (tenant.status === TenantStatus.SUSPENDED || tenant.status === TenantStatus.CLOSED) {
    return true;
  }
  if (BLOCKED_SUBSCRIPTION_STATUSES.includes(tenant.subscriptionStatus)) {
    return true;
  }
  if (isTrialExpired(tenant)) {
    return true;
  }
  return false;
}

export type EffectiveFeatureRow = {
  key: keyof PlanFeatures;
  label: string;
  inPlan: boolean;
  effective: boolean;
};

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  maxPatients: "Patient limit",
  maxUsers: "Staff limit",
  aiEnabled: "AI features",
  patientPortal: "Patient portal",
  inventory: "Inventory",
  crm: "CRM",
  multiBranch: "Multi-branch",
};

export function getEffectiveFeatureRows(
  tenant: Pick<
    Tenant,
    | "subscriptionPlan"
    | "status"
    | "subscriptionStatus"
    | "trialEndsAt"
    | "stripeSubscriptionId"
  >,
): EffectiveFeatureRow[] {
  const blocked = isTenantAccessBlocked(tenant);
  const planFeatures = getPlanFeatures(tenant.subscriptionPlan);

  return (Object.keys(FEATURE_LABELS) as Array<keyof PlanFeatures>).map((key) => {
    const raw = planFeatures[key];
    const inPlan = typeof raw === "boolean" ? raw : true;
    const effective =
      !blocked && (typeof raw === "boolean" ? canUseFeature(tenant.subscriptionPlan, key) : true);

    return {
      key,
      label: FEATURE_LABELS[key],
      inPlan,
      effective,
    };
  });
}

export function trialUrgencyClass(days: number): string {
  if (days <= 1) return "text-red-400";
  if (days <= 3) return "text-orange-400";
  if (days <= 7) return "text-amber-400";
  return "text-emerald-400";
}

export function formatUsageLimit(used: number, max: number): string {
  if (max === -1) return `${used} / Unlimited`;
  return `${used} / ${max}`;
}
