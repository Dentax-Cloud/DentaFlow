import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getTenantInvoiceTax } from "@/lib/billing/tenant-invoice-tax";
import { tenantWhere } from "@/lib/tenant/scoped";
import { generateInvoiceNumber } from "@/lib/utils";

/** ChairsideSession.status values (plain string in schema). */
export const CHAIRSIDE_SESSION_STATUS = {
  ACTIVE: "ACTIVE",
  FINALIZED: "FINALIZED",
  ABANDONED: "ABANDONED",
} as const;

export type ChairsideSessionStatus =
  (typeof CHAIRSIDE_SESSION_STATUS)[keyof typeof CHAIRSIDE_SESSION_STATUS];

export const CHAIRSIDE_CLOSED_REASON = {
  MANUAL_FINALIZE: "manual_finalize",
  AUTO_APPOINTMENT_COMPLETED: "auto_closed_appointment_completed",
  AUTO_APPOINTMENT_CANCELED: "auto_closed_appointment_canceled",
  AUTO_APPOINTMENT_NO_SHOW: "auto_closed_appointment_no_show",
  AUTO_APPOINTMENT_INVOICED: "auto_closed_appointment_invoiced",
  EXPIRED_STALE: "expired_stale",
} as const;

export type ChairsideClosedReason =
  (typeof CHAIRSIDE_CLOSED_REASON)[keyof typeof CHAIRSIDE_CLOSED_REASON];

const TERMINAL_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
  "INVOICED",
];

export function isTerminalAppointmentStatus(
  status: AppointmentStatus,
): status is (typeof TERMINAL_APPOINTMENT_STATUSES)[number] {
  return TERMINAL_APPOINTMENT_STATUSES.includes(status);
}

export function closedReasonForAppointmentStatus(
  status: AppointmentStatus,
): ChairsideClosedReason | null {
  switch (status) {
    case "COMPLETED":
      return CHAIRSIDE_CLOSED_REASON.AUTO_APPOINTMENT_COMPLETED;
    case "CANCELED":
      return CHAIRSIDE_CLOSED_REASON.AUTO_APPOINTMENT_CANCELED;
    case "NO_SHOW":
      return CHAIRSIDE_CLOSED_REASON.AUTO_APPOINTMENT_NO_SHOW;
    case "INVOICED":
      return CHAIRSIDE_CLOSED_REASON.AUTO_APPOINTMENT_INVOICED;
    default:
      return null;
  }
}

export function shouldFinalizeSessionOnTerminalStatus(status: AppointmentStatus): boolean {
  return status === "COMPLETED" || status === "INVOICED";
}

async function abandonChairsideSession(params: {
  sessionId: string;
  tenantId: string;
  closedReason: ChairsideClosedReason;
  staffMemberId?: string | null;
}) {
  await db.chairsideSession.update({
    where: { id: params.sessionId },
    data: {
      status: CHAIRSIDE_SESSION_STATUS.ABANDONED,
      finalizedAt: new Date(),
      closedReason: params.closedReason,
    },
  });

  await db.auditLog
    .create({
      data: {
        tenantId: params.tenantId,
        userId: params.staffMemberId ?? undefined,
        performedById: params.staffMemberId ?? undefined,
        action: "UPDATE",
        entity: "ChairsideSession",
        entityId: params.sessionId,
        metadata: {
          abandoned: true,
          closedReason: params.closedReason,
        },
      },
    })
    .catch(() => null);
}

export async function finalizeChairsideSessionRecord(params: {
  sessionId: string;
  tenantId: string;
  staffMemberId?: string | null;
  closedReason: ChairsideClosedReason;
  skipAppointmentUpdate?: boolean;
  allowInvoice?: boolean;
}): Promise<{ invoiceId: string | null }> {
  const session = await db.chairsideSession.findFirst({
    where: {
      id: params.sessionId,
      tenantId: params.tenantId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
    },
    include: {
      entries: { where: { includeInInvoice: true } },
      patient: true,
    },
  });
  if (!session) return { invoiceId: null };

  let invoiceId: string | null = null;

  if (session.entries.length > 0 && params.allowInvoice !== false) {
    const items = session.entries.map((e) => {
      const unitPrice = Number(e.unitPrice ?? 0);
      return {
        tenantId: params.tenantId,
        description: e.procedureName ?? e.conditionType ?? "Treatment",
        quantity: e.quantity,
        unitPrice,
        total: unitPrice * e.quantity,
        procedureCode: e.procedureCode ?? null,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const taxInfo = await getTenantInvoiceTax(params.tenantId);
    const tax = subtotal * taxInfo.taxRateDecimal;
    const total = subtotal + tax;

    const count = await db.invoice.count({ where: { tenantId: params.tenantId } });
    const invoice = await db.invoice.create({
      data: {
        tenantId: params.tenantId,
        patientId: session.patientId,
        invoiceNumber: generateInvoiceNumber(count + 1),
        status: "DRAFT",
        subtotal,
        tax,
        total,
        currency: taxInfo.currency,
        taxName: taxInfo.taxName,
        taxRateApplied: taxInfo.taxRatePercent,
        taxNumber: taxInfo.taxNumber,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: session.appointmentId
          ? `Chairside session · Appointment ${session.appointmentId}`
          : "Chairside session",
        items: { create: items },
      },
    });
    invoiceId = invoice.id;
  }

  if (session.appointmentId && !params.skipAppointmentUpdate) {
    await db.appointment
      .updateMany({
        where: tenantWhere(params.tenantId, { id: session.appointmentId }),
        data: { status: "COMPLETED" },
      })
      .catch(() => null);
  }

  await db.chairsideSession.update({
    where: { id: params.sessionId },
    data: {
      status: CHAIRSIDE_SESSION_STATUS.FINALIZED,
      finalizedAt: new Date(),
      closedReason: params.closedReason,
      invoiceId,
    },
  });

  await db.auditLog
    .create({
      data: {
        tenantId: params.tenantId,
        userId: params.staffMemberId ?? undefined,
        performedById: params.staffMemberId ?? undefined,
        action: "CREATE",
        entity: "ChairsideSession",
        entityId: params.sessionId,
        metadata: {
          patientId: session.patientId,
          entriesCount: session.entries.length,
          invoiceId,
          finalized: true,
          closedReason: params.closedReason,
        },
      },
    })
    .catch(() => null);

  return { invoiceId };
}

async function closeActiveSessionForTerminalAppointment(params: {
  sessionId: string;
  tenantId: string;
  appointmentStatus: AppointmentStatus;
  staffMemberId?: string | null;
  entryCount: number;
  allowInvoice?: boolean;
}) {
  const closedReason = closedReasonForAppointmentStatus(params.appointmentStatus);
  if (!closedReason) return;

  if (params.entryCount === 0) {
    await abandonChairsideSession({
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      closedReason,
      staffMemberId: params.staffMemberId,
    });
    return;
  }

  if (shouldFinalizeSessionOnTerminalStatus(params.appointmentStatus)) {
    await finalizeChairsideSessionRecord({
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      staffMemberId: params.staffMemberId,
      closedReason,
      skipAppointmentUpdate: true,
      allowInvoice: params.allowInvoice,
    });
    return;
  }

  await abandonChairsideSession({
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    closedReason,
    staffMemberId: params.staffMemberId,
  });
}

export async function autoCloseChairsideSessionsForAppointment(params: {
  tenantId: string;
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  staffMemberId?: string | null;
  allowInvoice?: boolean;
}) {
  if (!isTerminalAppointmentStatus(params.appointmentStatus)) return;

  const sessions = await db.chairsideSession.findMany({
    where: {
      tenantId: params.tenantId,
      appointmentId: params.appointmentId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
    },
    include: { _count: { select: { entries: true } } },
  });

  for (const session of sessions) {
    await closeActiveSessionForTerminalAppointment({
      sessionId: session.id,
      tenantId: params.tenantId,
      appointmentStatus: params.appointmentStatus,
      staffMemberId: params.staffMemberId,
      entryCount: session._count.entries,
      allowInvoice: params.allowInvoice,
    });
  }
}

const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

export async function expireStaleChairsideSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SESSION_MS);

  const staleSessions = await db.chairsideSession.findMany({
    where: {
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
      startedAt: { lt: cutoff },
    },
    select: { id: true, tenantId: true, patientId: true, appointmentId: true, startedAt: true },
  });

  for (const session of staleSessions) {
    await abandonChairsideSession({
      sessionId: session.id,
      tenantId: session.tenantId,
      closedReason: CHAIRSIDE_CLOSED_REASON.EXPIRED_STALE,
    });
    console.log(
      `[chairside] expired stale session ${session.id} (patient ${session.patientId}, started ${session.startedAt.toISOString()})`,
    );
  }

  return staleSessions.length;
}
