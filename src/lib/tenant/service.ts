import { clerkClient, currentUser } from "@/lib/auth/stubs/server";
import { db } from "@/lib/db";
import type { StaffMember, Tenant } from "@prisma/client";
import {
  UserRole,
  TenantStatus,
  SubscriptionStatus,
  TenantRole,
} from "@prisma/client";
import { slugify } from "@/lib/utils/slugify";
import { tenantConfig } from "./config";
import { resolveInitialTenantStatus } from "./isolation";
import { createApprovalRequest } from "./approval";
import { ensureStripeCustomer } from "./billing";
import { logTenantAudit } from "./audit";
import { AuditAction } from "@prisma/client";
import { getDefaultTrialSubscriptionFields, shouldExpireTrial, TRIAL_DURATION_DAYS } from "./trial";
import { mapClerkRoleToUserRole, resolveProvisionedUserRole, dentaflowRoleMetadata } from "./clerk-roles";
import {
  clearPendingTeamInvite,
  getPendingTeamInvite,
  readRoleFromClerkInvitation,
} from "./team-invites";
import { sendProvisionWelcomeEmail } from "@/lib/mail";

export type ProvisionResult = { tenant: Tenant; user: StaffMember; created: boolean };

/** Upsert tenant membership for NextAuth user (C6). */
export async function createTenantMembership(input: {
  tenantId: string;
  authUserId: string;
  role?: TenantRole;
}) {
  const role = input.role ?? TenantRole.ADMIN;
  return db.tenantMembership.upsert({
    where: {
      userId_tenantId: { userId: input.authUserId, tenantId: input.tenantId },
    },
    update: { role },
    create: {
      userId: input.authUserId,
      tenantId: input.tenantId,
      role,
    },
  });
}

/** Upsert staff row for a tenant (C5 — replaces db.user staff writes). */
export async function upsertStaffMember(input: {
  tenantId: string;
  clerkUserId: string;
  authUserId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: UserRole;
}) {
  return db.staffMember.upsert({
    where: {
      tenantId_clerkUserId: { tenantId: input.tenantId, clerkUserId: input.clerkUserId },
    },
    create: {
      tenantId: input.tenantId,
      clerkUserId: input.clerkUserId,
      authUserId: input.authUserId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      avatarUrl: input.avatarUrl,
      role: input.role,
      isActive: true,
    },
    update: {
      authUserId: input.authUserId ?? undefined,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      avatarUrl: input.avatarUrl,
      role: input.role,
    },
  });
}

async function linkAuthUserToTenant(params: {
  tenantId: string;
  email: string;
  staffMemberId: string;
  membershipRole?: TenantRole;
}) {
  const authUser = await db.user.findUnique({
    where: { email: params.email.toLowerCase().trim() },
  });
  if (!authUser) return null;

  await createTenantMembership({
    tenantId: params.tenantId,
    authUserId: authUser.id,
    role: params.membershipRole ?? TenantRole.ADMIN,
  });

  await db.staffMember.update({
    where: { id: params.staffMemberId },
    data: { authUserId: authUser.id },
  });

  return authUser;
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
}) {
  const initialStatus = resolveInitialTenantStatus();
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
        status: initialStatus,
        onboardingCompleted: false,
        featureFlags: {},
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
      role: TenantRole.ADMIN,
    }),
    db.staffMember.create({
      data: {
        tenantId: tenant.id,
        authUserId: input.ownerAuthUserId,
        email: input.ownerEmail,
        firstName,
        lastName,
        role: UserRole.ADMIN,
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

  if (tenant.status === TenantStatus.ACTIVE) {
    await ensureStripeCustomer(tenant);
    await ensureMinioBucket(tenant);
  }

  return { tenant, membership, staffMember, branch };
}

/**
 * Idempotent tenant + default admin user provisioning (fixes P2002 races).
 */
export async function provisionTenantForSession(
  clerkUserId: string,
  clerkOrgId: string,
): Promise<ProvisionResult> {
  const clerkUser = await currentUser();
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({ userId: clerkUserId });
  const membership = memberships.data.find((m) => m.organization.id === clerkOrgId);
  const orgName = membership?.organization.name ?? "My Clinic";

  const initialStatus = resolveInitialTenantStatus();

  const existing = await db.tenant.findUnique({ where: { clerkOrgId: clerkOrgId } });
  const created = !existing;

  const now = new Date();
  const trialDefaults = getDefaultTrialSubscriptionFields(now);

  const tenant = await syncTrialExpiry(
    await db.tenant.upsert({
      where: { clerkOrgId: clerkOrgId },
      create: {
        clerkOrgId: clerkOrgId,
        name: orgName,
        slug: slugify(orgName, clerkOrgId),
        status: initialStatus,
        locale: tenantConfig.defaultLocale,
        timezone: tenantConfig.defaultTimezone,
        onboardingCompleted: false,
        featureFlags: {},
        metadata: {},
        ...trialDefaults,
        settings: { create: {} },
      },
      update: {
        name: orgName,
      },
    }),
  );

  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";
  const pendingInviteRole = getPendingTeamInvite(tenant, email);
  const invitationRole =
    pendingInviteRole ??
    (email ? await readRoleFromClerkInvitation(clerkOrgId, email) : null);

  const role = resolveProvisionedUserRole({
    clerkMembershipRole: membership?.role,
    membershipMetadata: membership?.publicMetadata,
    pendingInviteRole: invitationRole,
  });

  const user = await upsertStaffMember({
    tenantId: tenant.id,
    clerkUserId,
    email,
    firstName: clerkUser?.firstName ?? undefined,
    lastName: clerkUser?.lastName ?? undefined,
    avatarUrl: clerkUser?.imageUrl,
    role: created ? UserRole.ADMIN : role,
  });

  if (email) {
    await linkAuthUserToTenant({
      tenantId: tenant.id,
      email,
      staffMemberId: user.id,
      membershipRole: TenantRole.ADMIN,
    });
  }

  if (invitationRole && email) {
    await clearPendingTeamInvite(tenant.id, email);
  }

  if (membership && email) {
    try {
      await client.organizations.updateOrganizationMembershipMetadata({
        organizationId: clerkOrgId,
        userId: clerkUserId,
        publicMetadata: dentaflowRoleMetadata(user.role),
      });
    } catch {
      // Non-fatal — DB role remains source of truth
    }
  }

  if (created && tenantConfig.approvalRequired && tenant.status === TenantStatus.PENDING) {
    await createApprovalRequest(tenant.id, clerkUserId);
  }

  if (tenant.status === TenantStatus.ACTIVE) {
    await ensureStripeCustomer(tenant);
    await ensureMinioBucket(tenant);
  }

  if (created) {
    await logTenantAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: AuditAction.CREATE,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: {
        clerkOrgId,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt?.toISOString(),
        subscriptionPlan: tenant.subscriptionPlan,
      },
    });

    if (email) {
      const adminName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() || "there";
      await sendProvisionWelcomeEmail({
        to: email,
        clinicName: orgName,
        adminName,
        trialDays: TRIAL_DURATION_DAYS,
      }).catch((err) => console.error("[mail:provision-welcome]", err));
    }
  }

  return { tenant, user, created };
}

/** Webhook / server-side provisioning without full Clerk user session */
export async function provisionTenantFromWebhook(params: {
  clerkOrgId: string;
  orgName?: string;
  clerkUserId?: string;
  authUserId?: string;
  ownerEmail?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
}) {
  const orgName = params.orgName ?? "New Clinic";
  const initialStatus = resolveInitialTenantStatus();

  const now = new Date();
  const trialDefaults = getDefaultTrialSubscriptionFields(now);

  const tenant = await syncTrialExpiry(
    await db.tenant.upsert({
      where: { clerkOrgId: params.clerkOrgId },
      create: {
        clerkOrgId: params.clerkOrgId,
        name: orgName,
        slug: slugify(orgName, params.clerkOrgId),
        status: initialStatus,
        locale: tenantConfig.defaultLocale,
        timezone: tenantConfig.defaultTimezone,
        onboardingCompleted: false,
        featureFlags: {},
        metadata: {},
        ...trialDefaults,
        settings: { create: {} },
      },
      update: { name: orgName },
    }),
  );

  if (params.clerkUserId) {
    const staffMember = await upsertStaffMember({
      tenantId: tenant.id,
      clerkUserId: params.clerkUserId,
      authUserId: params.authUserId,
      email: params.ownerEmail ?? "",
      firstName: params.ownerFirstName,
      lastName: params.ownerLastName,
      role: UserRole.ADMIN,
    });

    if (params.authUserId) {
      await createTenantMembership({
        tenantId: tenant.id,
        authUserId: params.authUserId,
        role: TenantRole.ADMIN,
      });
    } else if (params.ownerEmail) {
      await linkAuthUserToTenant({
        tenantId: tenant.id,
        email: params.ownerEmail,
        staffMemberId: staffMember.id,
        membershipRole: TenantRole.ADMIN,
      });
    }

    if (tenantConfig.approvalRequired && tenant.status === TenantStatus.PENDING) {
      await createApprovalRequest(tenant.id, params.clerkUserId);
    }
  }

  return tenant;
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

