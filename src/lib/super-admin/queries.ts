import { db } from "@/lib/db";
import { TenantStatus, type SubscriptionStatus } from "@prisma/client";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";

export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  email: string | null;
  city: string | null;
  country: string | null;
  tenantCode: string | null;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  activeUsers: number;
  totalPatients: number;
  totalAppointments: number;
  totalRevenue: number;
};

export type PlatformAnalytics = {
  totalTenants: number;
  activeTenants: number;
  pendingTenants: number;
  suspendedTenants: number;
  totalPatients: number;
  totalAppointments: number;
  totalRevenue: number;
  planBreakdown: Record<SubscriptionPlan, number>;
};

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  const [tenants, patientCount, appointmentCount, revenueAgg, planGroups] = await Promise.all([
    db.tenant.findMany({
      where: { deletedAt: null },
      select: { status: true, subscriptionPlan: true },
    }),
    db.patient.count({ where: { deletedAt: null } }),
    db.appointment.count({ where: { deletedAt: null } }),
    db.payment.aggregate({ _sum: { amount: true } }),
    db.tenant.groupBy({
      by: ["subscriptionPlan"],
      where: { deletedAt: null },
      _count: true,
    }),
  ]);

  const planBreakdown: Record<SubscriptionPlan, number> = {
    STARTER: 0,
    PROFESSIONAL: 0,
    ENTERPRISE: 0,
  };
  for (const g of planGroups) {
    planBreakdown[g.subscriptionPlan] = g._count;
  }

  return {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t) => t.status === "ACTIVE").length,
    pendingTenants: tenants.filter((t) => t.status === "PENDING").length,
    suspendedTenants: tenants.filter((t) => t.status === "SUSPENDED").length,
    totalPatients: patientCount,
    totalAppointments: appointmentCount,
    totalRevenue: Number(revenueAgg._sum.amount ?? 0),
    planBreakdown,
  };
}

export async function listTenantsWithStats(): Promise<TenantListItem[]> {
  const tenants = await db.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      email: true,
      city: true,
      country: true,
      tenantCode: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  const stats = await Promise.all(
    tenants.map(async (tenant) => {
      const [activeUsers, totalPatients, totalAppointments, revenue] = await Promise.all([
        db.staffMember.count({ where: { tenantId: tenant.id, deletedAt: null, isActive: true } }),
        db.patient.count({ where: { tenantId: tenant.id, deletedAt: null } }),
        db.appointment.count({ where: { tenantId: tenant.id, deletedAt: null } }),
        db.payment.aggregate({
          where: { tenantId: tenant.id },
          _sum: { amount: true },
        }),
      ]);

      return {
        ...tenant,
        activeUsers,
        totalPatients,
        totalAppointments,
        totalRevenue: Number(revenue._sum.amount ?? 0),
      };
    }),
  );

  return stats;
}

export async function getTenantDetail(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      settings: true,
      staffMembers: { where: { deletedAt: null }, take: 20, orderBy: { createdAt: "desc" } },
      _count: {
        select: {
          patients: true,
          appointments: true,
          invoices: true,
          staffMembers: true,
        },
      },
    },
  });

  if (!tenant) return null;

  const revenue = await db.payment.aggregate({
    where: { tenantId },
    _sum: { amount: true },
  });

  return {
    ...tenant,
    totalRevenue: Number(revenue._sum.amount ?? 0),
  };
}

export async function setTenantActive(
  tenantId: string,
  active: boolean,
  reason?: string,
) {
  return db.tenant.update({
    where: { id: tenantId },
    data: active
      ? {
          status: TenantStatus.ACTIVE,
          suspendedAt: null,
          suspendedReason: null,
        }
      : {
          status: TenantStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspendedReason: reason ?? null,
        },
  });
}
