import { db } from "@/lib/db";
import { broadcastAppointmentUpdate } from "@/lib/pusher";
import { notifyAppointmentStatus } from "@/lib/notifications/notification-service";
import { assertConsentForVisit } from "@/lib/clinical/consent-gate";
import { CHAIRSIDE_SESSION_STATUS } from "@/lib/clinical/chairside-lifecycle";

/** Transition ARRIVED → IN_CHAIR when a clinician begins charting. */
async function ensureAppointmentInChair(
  tenantId: string,
  appointmentId: string,
): Promise<boolean> {
  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, tenantId, deletedAt: null },
    include: { patient: true, chair: true },
  });
  if (!appointment || appointment.status !== "ARRIVED") return false;

  const updated = await db.appointment.update({
    where: { id: appointmentId },
    data: { status: "IN_CHAIR" },
    include: { patient: true, chair: true },
  });

  const patientName = updated.patient
    ? `${updated.patient.firstName} ${updated.patient.lastName}`
    : "Patient";
  await notifyAppointmentStatus(appointmentId, tenantId, "IN_CHAIR", patientName).catch(
    () => null,
  );
  await broadcastAppointmentUpdate(tenantId, updated).catch(() => null);
  return true;
}

export async function findActiveChairsideSession(params: {
  tenantId: string;
  sessionId: string;
  patientId: string;
}) {
  return db.chairsideSession.findFirst({
    where: {
      id: params.sessionId,
      tenantId: params.tenantId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
      patientId: params.patientId,
    },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Core chairside session start/resume — safe to call from RSC page render.
 * Does not call revalidatePath (caller must revalidate after user mutations).
 */
export async function getOrCreateActiveChairsideSession(params: {
  tenantId: string;
  staffMemberId: string | null;
  patientId: string;
  appointmentId?: string;
  /** When true, skip consent gate (caller already checked). */
  skipConsentCheck?: boolean;
}) {
  const patient = await db.patient.findFirst({
    where: { id: params.patientId, tenantId: params.tenantId, deletedAt: null },
  });
  if (!patient) throw new Error("Patient not found");

  if (!params.skipConsentCheck) {
    await assertConsentForVisit(params.tenantId, params.patientId);
  }

  if (params.appointmentId) {
    const apt = await db.appointment.findFirst({
      where: { id: params.appointmentId, tenantId: params.tenantId, deletedAt: null },
      select: { isBlock: true },
    });
    if (apt?.isBlock) {
      throw new Error("Blocked time cannot be opened as a chairside visit");
    }

    await ensureAppointmentInChair(params.tenantId, params.appointmentId);

    const existing = await db.chairsideSession.findFirst({
      where: {
        tenantId: params.tenantId,
        appointmentId: params.appointmentId,
        status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
      },
      include: { entries: { orderBy: { createdAt: "asc" } } },
    });
    if (existing) return existing;
  }

  return db.chairsideSession.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      appointmentId: params.appointmentId ?? null,
      staffId: params.staffMemberId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
    },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });
}
