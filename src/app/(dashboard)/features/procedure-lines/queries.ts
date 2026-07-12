import { db } from "@/lib/db";
import {
  clinicDateString,
  getClinicDayBounds,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";
import {
  formatOpenDuration,
  openDurationMinutes,
  visitBoardStallLevel,
  type VisitBoardStallLevel,
} from "@/lib/procedure-lines/stalled-line-thresholds";

export type VisitBoardLine = {
  id: string;
  ownerType: string;
  ownerId: string | null;
  ownerName: string | null;
  procedureName: string | null;
  procedureCode: string | null;
  status: string;
  createdAt: string;
  openDurationLabel: string;
  openMinutes: number;
  stallLevel: VisitBoardStallLevel;
};

export type VisitBoardAppointment = {
  id: string;
  patientId: string | null;
  patientName: string;
  chairName: string | null;
  status: string;
  startTime: string;
  lines: VisitBoardLine[];
};

export async function getVisitBoardAppointments(
  tenantId: string,
  timezone?: string | null,
): Promise<VisitBoardAppointment[]> {
  const tz = resolveClinicTimezone(timezone);
  const todayStr = clinicDateString(new Date(), tz);
  const { start, end } = getClinicDayBounds(todayStr, tz);
  const now = new Date();

  const [inChairAppointments, openLineRows] = await Promise.all([
    db.appointment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isBlock: false,
        status: "IN_CHAIR",
        startTime: { gte: start, lte: end },
      },
      select: { id: true },
    }),
    db.procedureLine.findMany({
      where: {
        tenantId,
        status: "IN_PROGRESS",
        appointment: {
          deletedAt: null,
          isBlock: false,
          startTime: { gte: start, lte: end },
        },
      },
      select: { appointmentId: true },
      distinct: ["appointmentId"],
    }),
  ]);

  const appointmentIds = [
    ...new Set([
      ...inChairAppointments.map((a) => a.id),
      ...openLineRows.map((l) => l.appointmentId),
    ]),
  ];

  if (appointmentIds.length === 0) return [];

  const appointments = await db.appointment.findMany({
    where: { tenantId, id: { in: appointmentIds } },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      chair: { select: { name: true } },
      procedureLines: { orderBy: [{ ownerType: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: { startTime: "asc" },
  });

  const ownerIds = [
    ...new Set(
      appointments.flatMap((appt) =>
        appt.procedureLines.map((line) => line.ownerId).filter(Boolean),
      ),
    ),
  ] as string[];

  const owners =
    ownerIds.length > 0
      ? await db.staffMember.findMany({
          where: { tenantId, id: { in: ownerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

  const ownerNameById = new Map(
    owners.map((owner) => [
      owner.id,
      `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || "Staff",
    ]),
  );

  return appointments.map((appt) => ({
    id: appt.id,
    patientId: appt.patient?.id ?? null,
    patientName: appt.patient
      ? `${appt.patient.firstName} ${appt.patient.lastName}`
      : "Unknown patient",
    chairName: appt.chair?.name ?? null,
    status: appt.status,
    startTime: appt.startTime.toISOString(),
    lines: appt.procedureLines.map((line) => ({
      id: line.id,
      ownerType: line.ownerType,
      ownerId: line.ownerId,
      ownerName: line.ownerId ? (ownerNameById.get(line.ownerId) ?? null) : null,
      procedureName: line.procedureName,
      procedureCode: line.procedureCode,
      status: line.status,
      createdAt: line.createdAt.toISOString(),
      openDurationLabel: formatOpenDuration(line.createdAt, now),
      openMinutes: openDurationMinutes(line.createdAt, now),
      stallLevel:
        line.status === "IN_PROGRESS"
          ? visitBoardStallLevel(line.createdAt, now)
          : ("normal" as VisitBoardStallLevel),
    })),
  }));
}
