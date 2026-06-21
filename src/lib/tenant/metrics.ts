/**
 * Tenant-scoped counts and staff lookups.
 * C5: staff counts use db.staffMember (not auth db.user).
 */
import { db } from "@/lib/db";

/** Simple counts for subscription usage limits and overview. */
export async function getTenantMetrics(tenantId: string) {
  const [users, patients, appointments, invoices] = await Promise.all([
    db.staffMember.count({ where: { tenantId, deletedAt: null } }),
    db.patient.count({ where: { tenantId, deletedAt: null } }),
    db.appointment.count({ where: { tenantId, deletedAt: null } }),
    db.invoice.count({ where: { tenantId, deletedAt: null } }),
  ]);

  return { users, patients, appointments, invoices };
}

/** Resolve staff row for the signed-in auth user within a tenant. */
export async function getStaffByAuthUserId(authUserId: string, tenantId: string) {
  return db.staffMember.findFirst({
    where: { authUserId, tenantId, isActive: true, deletedAt: null },
  });
}

/** Update tenant staff profile fields (StaffMember, not auth User). */
export async function updateStaffProfile(
  staffId: string,
  tenantId: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
  },
) {
  return db.staffMember.update({
    where: { id: staffId, tenantId },
    data,
  });
}
