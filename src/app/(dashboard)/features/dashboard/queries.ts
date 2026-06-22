import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import type { UserRole } from "@prisma/client";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";

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

export type TodayAppointmentRow = {
  id: string;
  title: string;
  status: string;
  startTime: Date;
  patientName: string;
  patientId: string;
};

export async function getRoleDashboardExtras(
  tenantId: string,
  role: UserRole,
  staffMemberId: string | null,
) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const dashboardRole = normalizeDashboardRole(role);

  let doctorId: string | null = null;
  if (staffMemberId && dashboardRole === "DOCTOR") {
    const doctor = await db.doctor.findFirst({
      where: { tenantId, userId: staffMemberId },
      select: { id: true },
    });
    doctorId = doctor?.id ?? null;
  }

  const todayWhere = {
    tenantId,
    deletedAt: null,
    startTime: { gte: todayStart, lte: todayEnd },
    ...(doctorId ? { doctorId } : {}),
  };

  const [todayList, waitingCount, pendingPlans] = await Promise.all([
    db.appointment.findMany({
      where: todayWhere,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { startTime: "asc" },
      take: 20,
    }),
    db.appointment.count({
      where: {
        tenantId,
        deletedAt: null,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { in: ["ARRIVED", "CONFIRMED"] },
      },
    }),
    db.treatmentPlan.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ["PROPOSED", "ACCEPTED", "IN_PROGRESS"] },
      },
    }),
  ]);

  return {
    todayAppointments: todayList.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      startTime: a.startTime,
      patientId: a.patient.id,
      patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    })),
    waitingCount,
    pendingTreatmentPlans: pendingPlans,
  };
}
