import { TenantStatus } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Soft-deletes a tenant/clinic account from the superadmin panel.
 *
 * - Marks the Tenant as deleted (`deletedAt`) and closed (`status: CLOSED`),
 *   matching the existing soft-delete convention used across the app
 *   (`deletedAt: null` is how every other query already excludes it).
 * - Deactivates every `tenant_memberships` row and soft-deletes every
 *   `StaffMember` row under the tenant.
 * - Frees up each owner/staff login's email address so it can be used to
 *   register a brand-new account, but ONLY for a login (`auth_users` row)
 *   that has no other active membership on a non-deleted tenant — a user
 *   who also belongs to a different clinic keeps their email and access
 *   there untouched.
 *
 * Nothing is hard-deleted: all clinical/financial records stay in place for
 * audit history, and the freed login rows are kept (with their email
 * anonymized) rather than removed, so foreign keys and audit trails that
 * reference them by id continue to resolve.
 */
export async function deleteTenantAccount(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, email: true, deletedAt: true },
  });
  if (!tenant) throw new Error("Tenant not found");
  if (tenant.deletedAt) return tenant;

  const memberships = await db.tenant_memberships.findMany({
    where: { tenantId },
    select: { userId: true },
  });

  const now = new Date();

  return db.$transaction(async (tx) => {
    const updatedTenant = await tx.tenant.update({
      where: { id: tenantId },
      data: { deletedAt: now, status: TenantStatus.CLOSED },
    });

    await tx.tenant_memberships.updateMany({
      where: { tenantId },
      data: { isActive: false },
    });

    await tx.staffMember.updateMany({
      where: { tenantId },
      data: { deletedAt: now, isActive: false },
    });

    for (const { userId } of memberships) {
      // If this login still has an active membership on some other,
      // non-deleted tenant, it still needs its real email — leave it alone.
      const stillNeededElsewhere = await tx.tenant_memberships.count({
        where: {
          userId,
          tenantId: { not: tenantId },
          isActive: true,
          Tenant: { deletedAt: null },
        },
      });
      if (stillNeededElsewhere > 0) continue;

      const authUser = await tx.auth_users.findUnique({ where: { id: userId } });
      if (!authUser || authUser.email.endsWith("@deleted.dentaflow.invalid")) {
        continue;
      }

      await tx.auth_users.update({
        where: { id: userId },
        data: {
          // ".invalid" is reserved (RFC 2606) for exactly this purpose: a
          // value guaranteed to never be a real, re-registerable address.
          email: `deleted+${userId}+${now.getTime()}@deleted.dentaflow.invalid`,
          passwordHash: null,
          activeTenantId: null,
        },
      });
    }

    return updatedTenant;
  });
}
