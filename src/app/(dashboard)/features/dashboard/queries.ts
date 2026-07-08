import { db } from "@/lib/db";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import type { UserRole } from "@prisma/client";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";
import {
  DASHBOARD_STATUS_GROUPS,
  getDashboardGroupColor,
} from "@/lib/appointments/status-colors";

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

  const emergencyIntakes = await db.emergencyIntake.findMany({
    where: {
      tenantId,
      createdAt: { gte: todayStart, lte: todayEnd },
      status: { notIn: ["COMPLETED", "REFERRED"] },
    },
    select: { status: true, triageLevel: true },
  });

  return {
    todayAppointments,
    completedToday,
    pendingInvoices,
    revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
    chairUtilization,
    patientCount,
    inChairNow,
    totalChairs,
    emergencyWaiting: emergencyIntakes.filter((i) => i.status === "WAITING").length,
    emergencyImmediate: emergencyIntakes.filter((i) => i.triageLevel === "IMMEDIATE").length,
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
    isBlock: false,
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
        isBlock: false,
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
    todayAppointments: todayList
      .filter((a) => a.patient != null)
      .map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      startTime: a.startTime,
      patientId: a.patient!.id,
      patientName: `${a.patient!.firstName} ${a.patient!.lastName}`,
    })),
    waitingCount,
    pendingTreatmentPlans: pendingPlans,
  };
}

export async function getRevenueTrend(tenantId: string, days = 30) {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(end, days - 1));

  const payments = await db.payment.findMany({
    where: { tenantId, paidAt: { gte: start, lte: end } },
    select: { paidAt: true, amount: true },
  });

  const byDate = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = format(subDays(end, days - 1 - i), "yyyy-MM-dd");
    byDate.set(d, 0);
  }

  for (const p of payments) {
    const key = format(p.paidAt, "yyyy-MM-dd");
    if (byDate.has(key)) {
      byDate.set(key, (byDate.get(key) ?? 0) + Number(p.amount));
    }
  }

  return Array.from(byDate.entries()).map(([date, revenue]) => ({
    date,
    label: format(new Date(`${date}T12:00:00`), "MMM d"),
    revenue: Math.round(revenue * 100) / 100,
  }));
}

export async function getTodayChairUtilizationByChair(tenantId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const hoursPerDay = 10;
  const availableMinutes = hoursPerDay * 60;

  const [chairs, appointments] = await Promise.all([
    db.chair.findMany({
      where: { tenantId, isActive: true },
      orderBy: { number: "asc" },
    }),
    db.appointment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isBlock: false,
        chairId: { not: null },
        startTime: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELED", "NO_SHOW"] },
      },
      select: { chairId: true, startTime: true, endTime: true },
    }),
  ]);

  return chairs.map((chair) => {
    const chairAppts = appointments.filter((a) => a.chairId === chair.id);
    const bookedMinutes = chairAppts.reduce(
      (sum, a) => sum + (a.endTime.getTime() - a.startTime.getTime()) / (60 * 1000),
      0,
    );
    const available = Math.round(availableMinutes);
    const booked = Math.round(bookedMinutes);
    const free = Math.max(0, available - booked);
    return {
      chairId: chair.id,
      chairName: chair.name,
      bookedMinutes: booked,
      availableMinutes: available,
      freeMinutes: free,
      utilizationPercent:
        available > 0 ? Math.min(100, Math.round((booked / available) * 100)) : 0,
    };
  });
}

export async function getTodayAppointmentStatusBreakdown(tenantId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const appointments = await db.appointment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isBlock: false,
      startTime: { gte: todayStart, lte: todayEnd },
    },
    select: { status: true },
  });

  return DASHBOARD_STATUS_GROUPS.map((group) => {
    const count = appointments.filter((a) =>
      group.statuses.includes(a.status),
    ).length;
    return {
      key: group.key,
      name: group.label,
      count,
      fill: getDashboardGroupColor(group.key),
    };
  });
}
