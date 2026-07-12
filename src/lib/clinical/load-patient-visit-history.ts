import { db } from "@/lib/db";

export type PatientVisitHistoryRow = {
  appointmentId: string;
  date: string;
  providerName: string | null;
  procedures: string[];
};

export async function loadPatientVisitHistory(
  tenantId: string,
  patientId: string,
  limit = 10,
): Promise<PatientVisitHistoryRow[]> {
  const appointments = await db.appointment.findMany({
    where: {
      tenantId,
      patientId,
      deletedAt: null,
      isBlock: false,
      status: "COMPLETED",
    },
    orderBy: { startTime: "desc" },
    take: limit,
    include: {
      doctor: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      procedureLines: {
        where: { status: { in: ["CLOSED", "LOCKED"] } },
        select: { procedureName: true, procedureCode: true },
      },
    },
  });

  const appointmentIds = appointments.map((a) => a.id);
  const sessions =
    appointmentIds.length > 0
      ? await db.chairsideSession.findMany({
          where: { tenantId, appointmentId: { in: appointmentIds } },
          include: {
            entries: {
              select: {
                procedureName: true,
                procedureCode: true,
                conditionType: true,
              },
            },
          },
        })
      : [];
  const entriesByAppointment = new Map<string, typeof sessions[number]["entries"]>();
  for (const session of sessions) {
    if (!session.appointmentId) continue;
    const existing = entriesByAppointment.get(session.appointmentId) ?? [];
    entriesByAppointment.set(session.appointmentId, [...existing, ...session.entries]);
  }

  return appointments.map((appt) => {
    const providerName = appt.doctor?.user
      ? `Dr. ${appt.doctor.user.firstName ?? ""} ${appt.doctor.user.lastName ?? ""}`.trim()
      : null;

    const fromLines = appt.procedureLines
      .map((line) => line.procedureName ?? line.procedureCode)
      .filter((label): label is string => Boolean(label));

    const sessionEntries = entriesByAppointment.get(appt.id) ?? [];
    const fromChart = sessionEntries
      .map((e) => e.procedureName ?? e.procedureCode ?? e.conditionType)
      .filter((label): label is string => Boolean(label));

    const procedures = [...new Set([...fromLines, ...fromChart])];

    return {
      appointmentId: appt.id,
      date: appt.startTime.toISOString(),
      providerName,
      procedures,
    };
  });
}
