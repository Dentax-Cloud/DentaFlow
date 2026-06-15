import { db } from "@/lib/db";

export async function getTenantMetrics(tenantId: string) {
  const [users, patients, appointments, invoices] = await Promise.all([
    db.user.count({ where: { tenantId, deletedAt: null } }),
    db.patient.count({ where: { tenantId, deletedAt: null } }),
    db.appointment.count({ where: { tenantId, deletedAt: null } }),
    db.invoice.count({ where: { tenantId, deletedAt: null } }),
  ]);

  return { users, patients, appointments, invoices };
}
