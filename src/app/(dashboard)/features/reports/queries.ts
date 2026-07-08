import { db } from "@/lib/db";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

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

  /** Prefer chairside session → invoiceId → appointment.doctorId (accurate attribution). */
  const sessions = await db.chairsideSession.findMany({
    where: {
      tenantId,
      invoiceId: { not: null },
      status: "FINALIZED",
      finalizedAt: { gte: start, lte: end },
      appointmentId: { not: null },
    },
    select: {
      invoiceId: true,
      appointmentId: true,
    },
  });

  const appointmentIds = [
    ...new Set(sessions.map((s) => s.appointmentId).filter(Boolean) as string[]),
  ];
  const linkedAppointments = await db.appointment.findMany({
    where: { tenantId, id: { in: appointmentIds }, doctorId: { not: null } },
    select: { id: true, doctorId: true },
  });
  const doctorByAppointment = new Map(
    linkedAppointments.map((a) => [a.id, a.doctorId!] as const),
  );

  const invoiceIds = [...new Set(sessions.map((s) => s.invoiceId).filter(Boolean) as string[])];
  const linkedInvoices = await db.invoice.findMany({
    where: {
      tenantId,
      id: { in: invoiceIds },
      deletedAt: null,
      status: { not: "VOID" },
    },
    select: {
      id: true,
      total: true,
      tax: true,
      cgstTotal: true,
      sgstTotal: true,
      igstTotal: true,
    },
  });
  const invoiceById = new Map(linkedInvoices.map((inv) => [inv.id, inv]));

  const revenueByDoctor = new Map<string, number>();
  const attributedInvoiceIds = new Set<string>();

  for (const session of sessions) {
    if (!session.invoiceId || !session.appointmentId) continue;
    const doctorId = doctorByAppointment.get(session.appointmentId);
    const invoice = invoiceById.get(session.invoiceId);
    if (!doctorId || !invoice || attributedInvoiceIds.has(invoice.id)) continue;
    attributedInvoiceIds.add(invoice.id);
    revenueByDoctor.set(
      doctorId,
      (revenueByDoctor.get(doctorId) ?? 0) + Number(invoice.total),
    );
  }

  /** Fallback for invoices without a chairside session link (same patient + clinic day). */
  const fallbackInvoices = await db.invoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      createdAt: { gte: start, lte: end },
      status: { in: ["PAID", "PARTIAL", "SENT"] },
      id: { notIn: [...attributedInvoiceIds] },
    },
    select: { id: true, total: true, patientId: true, createdAt: true },
  });

  for (const appt of appointments) {
    const doctorId = appt.doctorId!;
    const apptDay = appt.startTime.toDateString();
    const match = fallbackInvoices.find(
      (inv) =>
        inv.patientId === appt.patientId &&
        !attributedInvoiceIds.has(inv.id) &&
        inv.createdAt.toDateString() === apptDay,
    );
    if (match) {
      attributedInvoiceIds.add(match.id);
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

export async function getRevenueTaxSummaryReport(
  tenantId: string,
  range: ReportDateRange = "month",
) {
  const { start, end } = rangeBounds(range);

  const invoices = await db.invoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      createdAt: { gte: start, lte: end },
      status: { not: "VOID" },
    },
    select: {
      total: true,
      subtotal: true,
      tax: true,
      taxName: true,
      cgstTotal: true,
      sgstTotal: true,
      igstTotal: true,
      exemptSubtotal: true,
      taxableSubtotal: true,
      currency: true,
    },
  });

  const totals = {
    invoiceCount: invoices.length,
    currency: invoices[0]?.currency ?? "AED",
    taxName: invoices.find((i) => i.taxName)?.taxName ?? null,
    subtotal: 0,
    tax: 0,
    total: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    exemptSubtotal: 0,
    taxableSubtotal: 0,
  };

  for (const inv of invoices) {
    totals.subtotal += Number(inv.subtotal);
    totals.tax += Number(inv.tax);
    totals.total += Number(inv.total);
    totals.cgst += Number(inv.cgstTotal);
    totals.sgst += Number(inv.sgstTotal);
    totals.igst += Number(inv.igstTotal);
    totals.exemptSubtotal += Number(inv.exemptSubtotal);
    totals.taxableSubtotal += Number(inv.taxableSubtotal);
  }

  const hasGstBreakdown = totals.cgst > 0 || totals.sgst > 0 || totals.igst > 0;

  return {
    ...totals,
    subtotal: Math.round(totals.subtotal * 100) / 100,
    tax: Math.round(totals.tax * 100) / 100,
    total: Math.round(totals.total * 100) / 100,
    cgst: Math.round(totals.cgst * 100) / 100,
    sgst: Math.round(totals.sgst * 100) / 100,
    igst: Math.round(totals.igst * 100) / 100,
    exemptSubtotal: Math.round(totals.exemptSubtotal * 100) / 100,
    taxableSubtotal: Math.round(totals.taxableSubtotal * 100) / 100,
    hasGstBreakdown,
  };
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
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      itemType: true,
    },
  });

  const byProcedure = new Map<
    string,
    {
      name: string;
      count: number;
      totalRevenue: number;
      taxCollected: number;
    }
  >();

  for (const item of items) {
    const key = item.procedureCode ?? item.description;
    const row = byProcedure.get(key) ?? {
      name: item.description,
      count: 0,
      totalRevenue: 0,
      taxCollected: 0,
    };
    row.count += item.quantity;
    row.totalRevenue += Number(item.total);
    row.taxCollected +=
      Number(item.cgstAmount ?? 0) +
      Number(item.sgstAmount ?? 0) +
      Number(item.igstAmount ?? 0);
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

export async function getProcedureVolumeTrend(
  tenantId: string,
  months = 6,
) {
  const end = endOfMonth(new Date());
  const start = startOfMonth(subMonths(end, months - 1));

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
      quantity: true,
      invoice: { select: { createdAt: true } },
    },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    const d = subMonths(end, months - 1 - i);
    buckets.set(format(d, "yyyy-MM"), 0);
  }

  for (const item of items) {
    const key = format(item.invoice.createdAt, "yyyy-MM");
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + item.quantity);
    }
  }

  return Array.from(buckets.entries()).map(([month, volume]) => ({
    month,
    label: format(new Date(`${month}-01T12:00:00`), "MMM yyyy"),
    volume,
  }));
}

export async function getPayerMixReport(
  tenantId: string,
  range: ReportDateRange = "month",
) {
  const { start, end } = rangeBounds(range);

  const invoices = await db.invoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      createdAt: { gte: start, lte: end },
      status: { not: "VOID" },
    },
    select: {
      total: true,
      insuranceAmount: true,
      insurancePortion: true,
      providerCode: true,
      patient: { select: { insuranceProvider: true } },
    },
  });

  const byPayer = new Map<string, { name: string; revenue: number }>();

  for (const inv of invoices) {
    const insuranceAmt = Number(inv.insuranceAmount ?? inv.insurancePortion ?? 0);
    const total = Number(inv.total);
    const patientAmt = Math.max(0, total - insuranceAmt);

    const provider =
      inv.providerCode && inv.providerCode !== "SELF_PAY"
        ? inv.providerCode
        : inv.patient?.insuranceProvider &&
            inv.patient.insuranceProvider !== "SELF_PAY"
          ? inv.patient.insuranceProvider
          : null;

    if (insuranceAmt > 0 && provider) {
      const row = byPayer.get(provider) ?? { name: provider, revenue: 0 };
      row.revenue += insuranceAmt;
      byPayer.set(provider, row);
    }

    if (patientAmt > 0) {
      const row = byPayer.get("SELF_PAY") ?? { name: "Self-pay", revenue: 0 };
      row.revenue += patientAmt;
      byPayer.set("SELF_PAY", row);
    } else if (!provider && total > 0) {
      const row = byPayer.get("SELF_PAY") ?? { name: "Self-pay", revenue: 0 };
      row.revenue += total;
      byPayer.set("SELF_PAY", row);
    }
  }

  return Array.from(byPayer.values())
    .map((r) => ({
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
