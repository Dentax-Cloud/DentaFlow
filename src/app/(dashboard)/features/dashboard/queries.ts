import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export async function getDashboardKPIs(tenantId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [
    todayAppointments,
    completedToday,
    pendingInvoices,
    revenueThisMonth,
    totalChairs,
    inChairNow,
    patientCount,
  ] = await Promise.all([
    db.appointment.count({
      where: { tenantId, startTime: { gte: todayStart, lte: todayEnd }, deletedAt: null },
    }),
    db.appointment.count({
      where: {
        tenantId,
        startTime: { gte: todayStart, lte: todayEnd },
        status: "COMPLETED",
      },
    }),
    db.invoice.count({
      where: {
        tenantId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        deletedAt: null,
      },
    }),
    db.payment.aggregate({
      where: {
        tenantId,
        paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { amount: true },
    }),
    db.chair.count({ where: { tenantId, isActive: true } }),
    db.appointment.count({
      where: { tenantId, status: "IN_CHAIR", deletedAt: null },
    }),
    db.patient.count({ where: { tenantId, deletedAt: null } }),
  ]);

  const chairUtilization =
    totalChairs > 0 ? Math.round((inChairNow / totalChairs) * 100) : 0;

  return {
    todayAppointments,
    completedToday,
    pendingInvoices,
    revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
    chairUtilization,
    patientCount,
    inChairNow,
    totalChairs,
  };
}
