import { db } from "@/lib/db";
import { broadcastAppointmentUpdate } from "@/lib/pusher";
import { tenantWhere } from "@/lib/tenant/scoped";
import {
  autoCloseChairsideSessionsForAppointment,
} from "@/lib/clinical/chairside-lifecycle";
import {
  maybeCreateRecallAfterAppointment,
  refreshPatientRiskScores,
} from "@/lib/recall/helpers";
import { notifyAppointmentStatus } from "@/lib/notifications/notification-service";

export type CompleteVisitParams = {
  tenantId: string;
  appointmentId: string;
  staffMemberId?: string | null;
  /** When true, do not auto-close other active chairside sessions (e.g. during finalize). */
  skipChairsideAutoClose?: boolean;
  allowInvoice?: boolean;
  /** When set, COMPLETED notification reflects whether an invoice was created. */
  invoiceId?: string | null;
};

/**
 * Canonical visit completion — status transition + patient follow-up side effects.
 * Used by updateAppointmentStatus("COMPLETED") and finalizeChairsideSessionRecord.
 */
export async function completeVisit(params: CompleteVisitParams) {
  const appointment = await db.appointment.findFirst({
    where: tenantWhere(params.tenantId, { id: params.appointmentId, deletedAt: null }),
    include: { patient: true, chair: true, doctor: { include: { user: true } } },
  });
  if (!appointment) throw new Error("Appointment not found");
  if (appointment.isBlock || !appointment.patient) {
    throw new Error("Cannot complete a blocked time entry");
  }

  const wasAlreadyCompleted = appointment.status === "COMPLETED";

  if (!wasAlreadyCompleted) {
    await db.appointment.update({
      where: { id: appointment.id },
      data: { status: "COMPLETED" },
    });
  }

  const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;

  if (!wasAlreadyCompleted) {
    await notifyAppointmentStatus(
      appointment.id,
      params.tenantId,
      "COMPLETED",
      patientName,
      { invoiceId: params.invoiceId },
    ).catch(() => null);

    await db.patient.update({
      where: { id: appointment.patient.id },
      data: { lastVisitAt: new Date() },
    });

    await maybeCreateRecallAfterAppointment({
      tenantId: params.tenantId,
      patientId: appointment.patient.id,
    });

    await refreshPatientRiskScores(params.tenantId, appointment.patient.id);
  }

  if (!params.skipChairsideAutoClose) {
    await autoCloseChairsideSessionsForAppointment({
      tenantId: params.tenantId,
      appointmentId: appointment.id,
      appointmentStatus: "COMPLETED",
      staffMemberId: params.staffMemberId,
      allowInvoice: params.allowInvoice,
    }).catch(() => null);
  }

  const updated = await db.appointment.findFirst({
    where: { id: appointment.id },
    include: { patient: true, chair: true, doctor: { include: { user: true } } },
  });

  if (updated) {
    await broadcastAppointmentUpdate(params.tenantId, updated).catch(() => null);
  }

  return updated;
}
