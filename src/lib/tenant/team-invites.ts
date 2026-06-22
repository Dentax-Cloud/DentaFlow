import type { Tenant } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendTeamInviteEmail } from "@/lib/mail";

const PENDING_INVITES_KEY = "pendingTeamInvites";
const EMAIL_INVITES_KEY = "emailInvites";

type TenantMetadata = Record<string, unknown> & {
  pendingTeamInvites?: Record<string, UserRole>;
  emailInvites?: Record<
    string,
    {
      token: string;
      role: string;
      inviterName: string;
      expiresAt: string;
    }
  >;
};

function parseTenantMetadata(raw: Tenant["metadata"]): TenantMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as TenantMetadata;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPendingTeamInvite(tenant: Tenant, email: string): UserRole | null {
  const metadata = parseTenantMetadata(tenant.metadata);
  const pending = metadata.pendingTeamInvites ?? {};
  return pending[normalizeEmail(email)] ?? null;
}

export async function storePendingTeamInvite(
  tenantId: string,
  email: string,
  role: UserRole,
): Promise<void> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;

  const metadata = parseTenantMetadata(tenant.metadata);
  const pending = { ...(metadata.pendingTeamInvites ?? {}) };
  pending[normalizeEmail(email)] = role;

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      metadata: {
        ...metadata,
        pendingTeamInvites: pending,
      },
    },
  });
}

export async function clearPendingTeamInvite(
  tenantId: string,
  email: string,
): Promise<void> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;

  const metadata = parseTenantMetadata(tenant.metadata);
  const pending = { ...(metadata.pendingTeamInvites ?? {}) };
  delete pending[normalizeEmail(email)];

  const emailInvites = { ...(metadata.emailInvites ?? {}) };
  delete emailInvites[normalizeEmail(email)];

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      metadata: {
        ...metadata,
        pendingTeamInvites: pending,
        emailInvites,
      },
    },
  });
}

export async function listPendingTeamInvitesFromMetadata(
  tenantId: string,
): Promise<Array<{ email: string; role: UserRole }>> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return [];

  const metadata = parseTenantMetadata(tenant.metadata);
  const pending = metadata.pendingTeamInvites ?? {};
  return Object.entries(pending).map(([email, role]) => ({ email, role }));
}

export async function readRoleFromPendingInvite(
  tenantId: string,
  email: string,
): Promise<UserRole | null> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;
  return getPendingTeamInvite(tenant, email);
}

export async function sendTeamInvite({
  tenantId,
  inviterName,
  email,
  role,
}: {
  tenantId: string;
  inviterName: string;
  email: string;
  role: string;
}) {
  const normalized = normalizeEmail(email);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Clinic not found");

  const metadata = parseTenantMetadata(tenant.metadata);
  const emailInvites = { ...(metadata.emailInvites ?? {}) };
  emailInvites[normalized] = {
    token,
    role,
    inviterName,
    expiresAt: expiresAt.toISOString(),
  };

  const pending = { ...(metadata.pendingTeamInvites ?? {}) };
  if ((Object.values(UserRole) as string[]).includes(role)) {
    pending[normalized] = role as UserRole;
  }

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      metadata: {
        ...metadata,
        emailInvites,
        pendingTeamInvites: pending,
      },
    },
  });

  await sendTeamInviteEmail({
    to: normalized,
    inviteToken: token,
    clinicName: tenant.name,
    inviterName,
    role,
    expiresAt,
  });

  return { token, expiresAt };
}

export type ResolvedEmailInvite = {
  tenantId: string;
  tenantName: string;
  email: string;
  role: string;
  inviterName: string;
};

export async function resolveEmailInviteToken(
  token: string,
): Promise<ResolvedEmailInvite | null> {
  const tenants = await db.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, metadata: true },
  });

  const now = Date.now();
  for (const tenant of tenants) {
    const metadata = parseTenantMetadata(tenant.metadata);
    const invites = metadata.emailInvites ?? {};
    for (const [email, invite] of Object.entries(invites)) {
      if (invite.token !== token) continue;
      if (new Date(invite.expiresAt).getTime() < now) return null;
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        email,
        role: invite.role,
        inviterName: invite.inviterName,
      };
    }
  }
  return null;
}

export async function acceptEmailInvite(params: {
  token: string;
  authUserId: string;
  email: string;
}) {
  const resolved = await resolveEmailInviteToken(params.token);
  if (!resolved || resolved.email !== normalizeEmail(params.email)) {
    throw new Error("Invalid or expired invite");
  }

  const { randomUUID } = await import("crypto");
  await db.tenant_memberships.upsert({
    where: {
      userId_tenantId: { userId: params.authUserId, tenantId: resolved.tenantId },
    },
    create: {
      id: randomUUID(),
      userId: params.authUserId,
      tenantId: resolved.tenantId,
      role: resolved.role,
      isActive: true,
      invitedEmail: resolved.email,
      acceptedAt: new Date(),
    },
    update: {
      role: resolved.role,
      isActive: true,
      acceptedAt: new Date(),
    },
  });

  await db.auth_users.update({
    where: { id: params.authUserId },
    data: { activeTenantId: resolved.tenantId },
  });

  await clearPendingTeamInvite(resolved.tenantId, resolved.email);
  return resolved;
}
