import { db } from "@/lib/db";

export type ReportDateRange = "week" | "month" | "custom";

function rangeBounds(range: ReportDateRange, customStart?: Date, customEnd?: Date) {
  const end = customEnd ?? new Date();
  const start = customStart ?? new Date();
  if (!customStart) {
    if (range === "week") {
      start.setDate(end.getDate() - 7);
    } else {
      start.setMonth(end.getMonth() - 1);
    }
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getDoctorProductivityReport(
  tenantId: string,
  range: ReportDateRange = "month",
  customStart?: Date,
  customEnd?: Date,
) {
  const { start, end } = rangeBounds(range, customStart, customEnd);

  const appointments = await db.appointment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isBlock: false,
      status: "COMPLETED",
      startTime: { gte: start, lte: end },
      doctorId: { not: null },
    },
    include: {
      doctor: { include: { user: true } },
      patient: true,
    },
  });

  const byDoctor = new Map<
    string,
    {
      doctorId: string;
      doctorName: string;
      appointmentsCompleted: number;
      revenue: number;
    }
  >();

  for (const appt of appointments) {
    const id = appt.doctorId!;
    const name = appt.doctor?.user
      ? `${appt.doctor.user.firstName ?? ""} ${appt.doctor.user.lastName ?? ""}`.trim()
      : "Unknown";
    const row = byDoctor.get(id) ?? {
      doctorId: id,
      doctorName: name,
      appointmentsCompleted: 0,
      revenue: 0,
    };
    row.appointmentsCompleted++;
    byDoctor.set(id, row);
  }

  const invoices = await db.invoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      createdAt: { gte: start, lte: end },
      status: { in: ["PAID", "PARTIAL", "SENT"] },
    },
    select: { id: true, total: true, patientId: true, createdAt: true },
  });

  const revenueByDoctor = new Map<string, number>();
  const usedInvoiceIds = new Set<string>();

  for (const appt of appointments) {
    const doctorId = appt.doctorId!;
    const apptDay = appt.startTime.toDateString();
    const match = invoices.find(
      (inv) =>
        inv.patientId === appt.patientId &&
        !usedInvoiceIds.has(inv.id) &&
        inv.createdAt.toDateString() === apptDay,
    );
    if (match) {
      usedInvoiceIds.add(match.id);
      revenueByDoctor.set(
        doctorId,
        (revenueByDoctor.get(doctorId) ?? 0) + Number(match.total),
      );
    }
  }

  const doctors = Array.from(byDoctor.values());
  for (const d of doctors) {
    d.revenue = Math.round(revenueByDoctor.get(d.doctorId) ?? 0);
  }

  return doctors.sort((a, b) => b.appointmentsCompleted - a.appointmentsCompleted);
}

export async function getRevenueByProcedureReport(
  tenantId: string,
  range: ReportDateRange = "month",
) {
  const { start, end } = rangeBounds(range);

  const items = await db.invoiceItem.findMany({
    where: {
      tenantId,
      invoice: {
        deletedAt: null,
        createdAt: { gte: start, lte: end },
        status: { not: "VOID" },
      },
    },
    select: {
      description: true,
      quantity: true,
      total: true,
      procedureCode: true,
    },
  });

  const byProcedure = new Map<
    string,
    { name: string; count: number; totalRevenue: number }
  >();

  for (const item of items) {
    const key = item.procedureCode ?? item.description;
    const row = byProcedure.get(key) ?? {
      name: item.description,
      count: 0,
      totalRevenue: 0,
    };
    row.count += item.quantity;
    row.totalRevenue += Number(item.total);
    byProcedure.set(key, row);
  }

  return Array.from(byProcedure.values())
    .map((r) => ({
      ...r,
      averagePerVisit: r.count > 0 ? r.totalRevenue / r.count : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function getPatientRetentionReport(tenantId: string, range: ReportDateRange = "month") {
  const { start, end } = rangeBounds(range);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [newPatients, returningPatients, overdueRecalls, visitGaps] = await Promise.all([
    db.patient.count({
      where: { tenantId, deletedAt: null, createdAt: { gte: start, lte: end } },
    }),
    db.patient.count({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { lt: start },
        lastVisitAt: { gte: start, lte: end },
      },
    }),
    db.recall.count({
      where: {
        tenantId,
        status: "PENDING",
        completedAt: null,
        dueDate: { lt: new Date() },
      },
    }),
    db.patient.findMany({
      where: { tenantId, deletedAt: null, lastVisitAt: { not: null } },
      select: { lastVisitAt: true, createdAt: true },
      take: 200,
    }),
  ]);

  let gapSum = 0;
  let gapCount = 0;
  for (const p of visitGaps) {
    if (p.lastVisitAt) {
      gapSum +=
        (p.lastVisitAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      gapCount++;
    }
  }

  return {
    newPatients,
    returningPatients,
    overdueRecalls,
    averageDaysBetweenVisits: gapCount > 0 ? Math.round(gapSum / gapCount) : 0,
    inactivePatients: await db.patient.count({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ lastVisitAt: null }, { lastVisitAt: { lt: sixMonthsAgo } }],
      },
    }),
  };
}

export async function getChairUtilizationReport(tenantId: string, range: ReportDateRange = "week") {
  const { start, end } = rangeBounds(range);

  const [chairs, appointments, settings] = await Promise.all([
    db.chair.findMany({ where: { tenantId, isActive: true } }),
    db.appointment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isBlock: false,
        chairId: { not: null },
        startTime: { gte: start, lte: end },
        status: { notIn: ["CANCELED", "NO_SHOW"] },
      },
      select: { chairId: true, startTime: true, endTime: true },
    }),
    db.settings.findUnique({ where: { tenantId } }),
  ]);

  const slotMins = settings?.appointmentDuration ?? 30;
  const daysInRange = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const hoursPerDay = 10;
  const availableMinutesPerChair = daysInRange * hoursPerDay * 60;

  const byChair = chairs.map((chair) => {
    const chairAppts = appointments.filter((a) => a.chairId === chair.id);
    const bookedMinutes = chairAppts.reduce((s, a) => {
      return s + (a.endTime.getTime() - a.startTime.getTime()) / (60 * 1000);
    }, 0);
    const utilization =
      availableMinutesPerChair > 0
        ? Math.round((bookedMinutes / availableMinutesPerChair) * 100)
        : 0;
    return {
      chairId: chair.id,
      chairName: chair.name,
      hoursBooked: Math.round((bookedMinutes / 60) * 10) / 10,
      hoursAvailable: (availableMinutesPerChair / 60) * (chairs.length > 0 ? 1 : 0),
      utilizationPercent: Math.min(100, utilization),
    };
  });

  const heatmap: Record<string, Record<number, number>> = {};
  for (const appt of appointments) {
    const day = appt.startTime.getDay();
    const hour = appt.startTime.getHours();
    const key = String(day);
    if (!heatmap[key]) heatmap[key] = {};
    heatmap[key][hour] = (heatmap[key][hour] ?? 0) + 1;
  }

  return { byChair, heatmap, slotMins };
}
