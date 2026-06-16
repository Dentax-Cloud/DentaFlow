import type { Tenant } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

const PENDING_INVITES_KEY = "pendingTeamInvites";

type TenantMetadata = Record<string, unknown> & {
  pendingTeamInvites?: Record<string, UserRole>;
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

export function getPendingTeamInvite(
  tenant: Tenant,
  email: string,
): UserRole | null {
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

export async function readRoleFromClerkInvitation(
  organizationId: string,
  email: string,
): Promise<UserRole | null> {
  const { clerkClient } = await import("@/lib/auth/stubs/server");
  const { readDentaflowRoleFromMetadata } = await import("./clerk-roles");
  const client = await clerkClient();
  const normalized = normalizeEmail(email);

  for (const status of ["pending", "accepted"] as const) {
    const list = await client.organizations.getOrganizationInvitationList({
      organizationId,
      status: [status],
    });

    const match = list.data.find(
      (inv) => inv.emailAddress.toLowerCase() === normalized,
    );
    const role = readDentaflowRoleFromMetadata(match?.publicMetadata);
    if (role) return role;
  }

  return null;
}
