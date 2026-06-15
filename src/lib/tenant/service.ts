import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { Tenant, User } from "@prisma/client";
import { UserRole, TenantStatus, SubscriptionStatus } from "@prisma/client";
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

export type ProvisionResult = { tenant: Tenant; user: User; created: boolean };

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

  const user = await db.user.upsert({
    where: {
      tenantId_clerkUserId: { tenantId: tenant.id, clerkUserId },
    },
    create: {
      tenantId: tenant.id,
      clerkUserId,
      email,
      firstName: clerkUser?.firstName ?? undefined,
      lastName: clerkUser?.lastName ?? undefined,
      avatarUrl: clerkUser?.imageUrl,
      role: created ? UserRole.ADMIN : role,
      isActive: true,
    },
    update: {
      email,
      firstName: clerkUser?.firstName ?? undefined,
      lastName: clerkUser?.lastName ?? undefined,
      avatarUrl: clerkUser?.imageUrl,
      role,
    },
  });

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
    await db.user.upsert({
      where: {
        tenantId_clerkUserId: {
          tenantId: tenant.id,
          clerkUserId: params.clerkUserId,
        },
      },
      create: {
        tenantId: tenant.id,
        clerkUserId: params.clerkUserId,
        email: "",
        role: UserRole.ADMIN,
        isActive: true,
      },
      update: { tenantId: tenant.id },
    });

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

