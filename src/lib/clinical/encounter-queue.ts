import { db } from "@/lib/db";
import {
  clinicDateString,
  getClinicDayBounds,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";

export type EncounterQueueRow = {
  id: string;
  patientId: string;
  patientName: string;
  status: string;
  startTime: string;
  chairName: string | null;
  doctorName: string | null;
};

export async function getEncounterQueueAppointments(
  tenantId: string,
  timezone?: string | null,
): Promise<EncounterQueueRow[]> {
  const tz = resolveClinicTimezone(timezone);
  const todayStr = clinicDateString(new Date(), tz);
  const { start, end } = getClinicDayBounds(todayStr, tz);

  const appointments = await db.appointment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isBlock: false,
      status: { in: ["ARRIVED", "IN_CHAIR"] },
      startTime: { gte: start, lte: end },
      patientId: { not: null },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      chair: { select: { name: true } },
      doctor: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return appointments
    .filter((appt) => appt.patient)
    .map((appt) => {
      const patient = appt.patient!;
      const doctorName = appt.doctor?.user
        ? `Dr. ${appt.doctor.user.firstName ?? ""} ${appt.doctor.user.lastName ?? ""}`.trim()
        : null;
      return {
        id: appt.id,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`.trim(),
        status: appt.status,
        startTime: appt.startTime.toISOString(),
        chairName: appt.chair?.name ?? null,
        doctorName,
      };
    });
}
