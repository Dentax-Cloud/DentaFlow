import { db } from "@/lib/db";
import { SubscriptionStatus } from "@prisma/client";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { requireTenantContext } from "@/lib/tenant/context";
import { isTrialExpired } from "@/lib/tenant/trial";
import { canUseFeature, type PlanFeatures } from "./plans";

const PLAN_LIMITS: Record<
  SubscriptionPlan,
  { patients: number; staff: number; branches: number }
> = {
  STARTER: { patients: 200, staff: 5, branches: 1 },
  PROFESSIONAL: { patients: 1000, staff: 20, branches: 5 },
  ENTERPRISE: { patients: Infinity, staff: Infinity, branches: Infinity },
};

const BLOCKED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.EXPIRED,
];

export class LimitExceededError extends Error {
  constructor(
    public readonly resource: string,
    public readonly current: number,
    public readonly limit: number,
    public readonly plan: SubscriptionPlan,
    public readonly upgradeUrl = "/billing/subscription",
  ) {
    super(`${resource} limit reached (${current}/${limit} on ${plan} plan)`);
    this.name = "LimitExceededError";
  }
}

function getLimits(plan: SubscriptionPlan) {
  return PLAN_LIMITS[plan];
}

export async function requireActiveSubscription() {
  const ctx = await requireTenantContext();
  if (ctx.isSuperAdmin) return ctx;

  if (BLOCKED_STATUSES.includes(ctx.tenant.subscriptionStatus)) {
    throw new Error("SUBSCRIPTION_INACTIVE");
  }

  if (isTrialExpired(ctx.tenant)) {
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

export async function checkPatientLimit(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });
  if (!tenant) throw new Error("Tenant not found");

  const limit = getLimits(tenant.subscriptionPlan).patients;
  if (limit === Infinity) return;

  const current = await db.patient.count({
    where: { tenantId, deletedAt: null },
  });

  if (current >= limit) {
    throw new LimitExceededError("Patients", current, limit, tenant.subscriptionPlan);
  }
}

export async function checkStaffLimit(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });
  if (!tenant) throw new Error("Tenant not found");

  const limit = getLimits(tenant.subscriptionPlan).staff;
  if (limit === Infinity) return;

  const current = await db.staffMember.count({
    where: { tenantId, isActive: true, deletedAt: null },
  });

  if (current >= limit) {
    throw new LimitExceededError("Staff members", current, limit, tenant.subscriptionPlan);
  }
}

export async function checkBranchLimit(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });
  if (!tenant) throw new Error("Tenant not found");

  const limit = getLimits(tenant.subscriptionPlan).branches;
  if (limit === Infinity) return;

  const current = await db.branch.count({
    where: { tenantId, deletedAt: null },
  });

  if (current >= limit) {
    throw new LimitExceededError("Branches", current, limit, tenant.subscriptionPlan);
  }
}

export async function getUsageSummary(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });
  if (!tenant) throw new Error("Tenant not found");

  const limits = getLimits(tenant.subscriptionPlan);

  const [patientCount, staffCount, branchCount] = await Promise.all([
    db.patient.count({ where: { tenantId, deletedAt: null } }),
    db.staffMember.count({ where: { tenantId, isActive: true, deletedAt: null } }),
    db.branch.count({ where: { tenantId, deletedAt: null } }),
  ]);

  return {
    plan: tenant.subscriptionPlan,
    patients: {
      current: patientCount,
      limit: limits.patients,
      unlimited: limits.patients === Infinity,
    },
    staff: {
      current: staffCount,
      limit: limits.staff,
      unlimited: limits.staff === Infinity,
    },
    branches: {
      current: branchCount,
      limit: limits.branches,
      unlimited: limits.branches === Infinity,
    },
  };
}
