import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { getPrimaryInsuranceStatusMap } from "@/app/(dashboard)/features/insurance/insurance-policy-actions";
import { getAppointments, getChairs, getDoctors } from "@/app/(dashboard)/features/appointments/actions";
import { db } from "@/lib/db";
import { startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { serializeEntity, serializeMany } from "@/lib/utils/serialize";
import { AppointmentsClient } from "./appointments-client";

type Props = {
  searchParams: Promise<{ patientId?: string; appointmentId?: string }>;
};

export default async function AppointmentsPage({ searchParams }: Props) {
  const ctx = await requireRouteAccess("appointments", "read");
  const { patientId, appointmentId } = await searchParams;
  const now = new Date();

  const [appointments, chairs, patients, doctors, emergencyStats, insuranceStatusMap] = await Promise.all([
    getAppointments(ctx.tenant.id, {
      start: startOfWeek(now),
      end: endOfWeek(now),
    }),
    getChairs(ctx.tenant.id),
    getPatients(ctx.tenant.id),
    getDoctors(ctx.tenant.id),
    db.emergencyIntake.findMany({
      where: {
        tenantId: ctx.tenant.id,
        createdAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { notIn: ["COMPLETED", "REFERRED"] },
      },
      select: { status: true, triageLevel: true },
    }),
    getPrimaryInsuranceStatusMap(ctx.tenant.id),
  ]);

  const serializedAppointments = appointments.map((appointment) => {
    const serialized = serializeEntity(appointment, {
      patient: "object",
      chair: "object",
    });
    return {
      ...serialized,
      doctor: appointment.doctor
        ? serializeEntity(appointment.doctor, { user: "object" })
        : null,
    };
  });

  return (
    <AppointmentsClient
      initialAppointments={serializedAppointments}
      chairs={serializeMany(chairs)}
      patients={serializeMany(patients)}
      doctors={doctors.map((doctor) => serializeEntity(doctor, { user: "object" }))}
      tenantId={ctx.tenant.id}
      defaultPatientId={patientId}
      initialAppointmentId={appointmentId}
      emergencyWaiting={emergencyStats.filter((e) => e.status === "WAITING").length}
      emergencyImmediate={emergencyStats.filter((e) => e.triageLevel === "IMMEDIATE").length}
      insuranceStatusMap={insuranceStatusMap}
    />
  );
}
