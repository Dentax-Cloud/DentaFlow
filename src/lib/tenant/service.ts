import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { StaffMember, Tenant } from "@prisma/client";
import {
  UserRole,
  TenantStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { slugify } from "@/lib/utils/slugify";
import { tenantConfig } from "./config";
import { ensureStripeCustomer } from "./billing";
import { seedTenantDefaults } from "./defaults";
import { getDefaultTrialSubscriptionFields, shouldExpireTrial } from "./trial";
import {
  generateTenantCode,
  generateGlobalTenantId,
  generateBranchCode,
  getCityCode,
} from "@/lib/ids/generate-ids";
import { syncTenantCountryProfile } from "./sync-country-profile";
import { DEFAULT_TENANT_FEATURE_FLAGS } from "./default-feature-flags";

export type ProvisionResult = { tenant: Tenant; user: StaffMember; created: boolean };

/** Upsert tenant membership for NextAuth user (C6). */
export async function createTenantMembership(input: {
  tenantId: string;
  authUserId: string;
  role?: string;
}) {
  const role = input.role ?? "OWNER";
  return db.tenant_memberships.upsert({
    where: {
      userId_tenantId: { userId: input.authUserId, tenantId: input.tenantId },
    },
    update: { role },
    create: {
      id: randomUUID(),
      userId: input.authUserId,
      tenantId: input.tenantId,
      role,
    },
  });
}

/**
 * NextAuth-native provisioning: tenant + membership + staff + default branch.
 */
export async function provisionTenant(input: {
  ownerAuthUserId: string;
  ownerName: string;
  ownerEmail: string;
  clinicName: string;
  clinicEmail: string;
  phone?: string;
  address?: string;
  timezone?: string;
  countryCode?: string;
}) {
  const now = new Date();
  const trialDefaults = getDefaultTrialSubscriptionFields(now);
  const nameParts = input.ownerName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || undefined;

  const tenant = await syncTrialExpiry(
    await db.tenant.create({
      data: {
        name: input.clinicName,
        slug: slugify(input.clinicName, input.ownerAuthUserId),
        email: input.clinicEmail,
        phone: input.phone ?? null,
        address: input.address ?? null,
        timezone: input.timezone ?? tenantConfig.defaultTimezone,
        locale: tenantConfig.defaultLocale,
        status: TenantStatus.ACTIVE,
        onboardingCompleted: false,
        featureFlags: { ...DEFAULT_TENANT_FEATURE_FLAGS },
        metadata: {},
        ...trialDefaults,
        settings: { create: {} },
      },
    }),
  );

  const [membership, staffMember] = await Promise.all([
    createTenantMembership({
      tenantId: tenant.id,
      authUserId: input.ownerAuthUserId,
      role: "OWNER",
    }),
    db.staffMember.create({
      data: {
        tenantId: tenant.id,
        authUserId: input.ownerAuthUserId,
        email: input.ownerEmail,
        firstName,
        lastName,
        role: UserRole.OWNER,
        isActive: true,
      },
    }),
  ]);

  const branch = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: "Main Office",
      address: input.address ?? null,
      phone: input.phone ?? null,
      isPrimary: true,
    },
  });

  const countryCode = input.countryCode ?? "AE";
  const tenantCode = await generateTenantCode(countryCode);
  const globalTenantId = generateGlobalTenantId(tenantCode, tenant.id);
  await db.tenant.update({
    where: { id: tenant.id },
    data: { tenantCode, globalTenantId, countryCode },
  });

  await syncTenantCountryProfile(tenant.id, countryCode);

  const cityCode = getCityCode(tenant.city ?? "Dubai");
  const { branchCode, branchSeq } = await generateBranchCode(tenant.id, cityCode);
  await db.branch.update({
    where: { id: branch.id },
    data: { branchCode, cityCode, branchSeq },
  });

  await ensureMinioBucket(tenant);
  await seedTenantDefaults(tenant);
  const tenantWithBilling = await ensureStripeCustomer(tenant);

  return { tenant: tenantWithBilling, membership, staffMember, branch };
}

/**
 * Lazily transition TRIALING → EXPIRED when trialEndsAt has passed.
 * Skips tenants with an active Stripe subscription.
 */
export async function syncTrialExpiry(tenant: Tenant): Promise<Tenant> {
  if (!shouldExpireTrial(tenant)) return tenant;

  return db.tenant.update({
    where: { id: tenant.id },
    data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
  });
}

async function ensureMinioBucket(tenant: Tenant) {
  if (!process.env.MINIO_ENDPOINT) return;
  const bucket = `${tenantConfig.minioBucketPrefix}-${tenant.id}`;
  // Bucket creation is handled by docker minio_init; store intent in metadata
  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      metadata: {
        ...(typeof tenant.metadata === "object" && tenant.metadata !== null
          ? (tenant.metadata as Record<string, unknown>)
          : {}),
        minioBucket: bucket,
      },
    },
  });
}

