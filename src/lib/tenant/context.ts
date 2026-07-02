/** Node.js runtime only — consumed by layouts/pages that export `runtime = "nodejs"`. */
import { cache } from "react";
import type { StaffMember, Tenant } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncTrialExpiry } from "./service";
import { getActiveTenantOrThrow } from "./isolation";
import { getTenantTrialInfo, type TenantTrialInfo } from "./trial";
import { requireTenantMembership } from "./access";
import { getCountryProfile, type CountryProfile } from "@/lib/countries";

export type { TenantTrialInfo };

export type TenantContext = {
  tenant: Tenant;
  staffMember: StaffMember | null;
  authUserId: string;
  tenantSlug: string;
  tenantId: string;
  isSuperAdmin: boolean;
  trial: TenantTrialInfo;
  countryProfile: CountryProfile;
  currency: string;
  taxRate: number;
  taxName: string;
  /** @deprecated Use staffMember */
  user: StaffMember | null;
};

function buildTenantContext(params: {
  tenant: Tenant;
  staffMember: StaffMember | null;
  authUserId: string;
  tenantSlug: string;
  isSuperAdmin: boolean;
}): TenantContext {
  const { tenant, staffMember, authUserId, tenantSlug, isSuperAdmin } = params;
  const countryProfile = getCountryProfile(tenant.countryCode ?? "AE");
  return {
    tenant,
    staffMember,
    authUserId,
    tenantSlug,
    tenantId: tenant.id,
    isSuperAdmin,
    trial: getTenantTrialInfo(tenant),
    countryProfile,
    currency: tenant.currency ?? countryProfile.currency,
    taxRate: Number(tenant.taxRate ?? countryProfile.taxRate),
    taxName: tenant.taxName ?? countryProfile.taxName,
    user: staffMember,
  };
}

export async function resolveTenantFromSlug(slug: string): Promise<Tenant | null> {
  return db.tenant.findUnique({ where: { slug } });
}

export async function getTenantContextBySlug(slug: string): Promise<TenantContext | null> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return null;

  const tenant = await resolveTenantFromSlug(slug);
  if (!tenant) return null;

  await requireTenantMembership(tenant.id);

  const tenantSynced = await syncTrialExpiry(tenant);

  const staffMember = await db.staffMember.findFirst({
    where: { tenantId: tenant.id, authUserId: session.user.id },
  });

  return buildTenantContext({
    tenant: tenantSynced,
    staffMember,
    authUserId: session.user.id,
    tenantSlug: slug,
    isSuperAdmin: session.user.isSuperAdmin,
  });
}

export async function requireTenantContextBySlug(slug: string): Promise<TenantContext> {
  const ctx = await getTenantContextBySlug(slug);
  if (!ctx) throw new Error("UNAUTHORIZED");
  return ctx;
}

export async function requireActiveTenantContextBySlug(slug: string): Promise<TenantContext> {
  const ctx = await requireTenantContextBySlug(slug);
  getActiveTenantOrThrow(ctx.tenant, ctx.authUserId);
  return ctx;
}

/** Resolves tenant from session activeTenantId (cached once per request). */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const session = await getServerAuthSession();
  if (!session?.user?.activeTenantId) return null;

  const tenant = await db.tenant.findUnique({
    where: { id: session.user.activeTenantId },
  });
  if (!tenant) return null;

  return getTenantContextBySlug(tenant.slug);
});

export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  return ctx;
}

export async function requireActiveTenantContext(): Promise<TenantContext> {
  const ctx = await requireTenantContext();
  getActiveTenantOrThrow(ctx.tenant, ctx.authUserId);
  return ctx;
}

/** Staff member performing the action — throws if session has no clinic membership row. */
export function getStaffActor(ctx: TenantContext): StaffMember {
  if (!ctx.staffMember) throw new Error("UNAUTHORIZED");
  return ctx.staffMember;
}

export async function getUserWithRole() {
  const ctx = await getTenantContext();
  if (!ctx?.staffMember) return null;
  return {
    user: ctx.staffMember,
    role: ctx.staffMember.role,
    tenant: ctx.tenant,
    isSuperAdmin: ctx.isSuperAdmin,
  };
}

/** Tenants the signed-in user can access via membership. */
export async function getUserTenants() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return [];

  const memberships = await db.tenant_memberships.findMany({
    where: { userId: session.user.id },
    include: { Tenant: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    ...m.Tenant,
    role: m.role,
    membershipId: m.id,
  }));
}
