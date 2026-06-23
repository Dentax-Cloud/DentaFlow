import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { getAppointments, getChairs, getDoctors } from "@/app/(dashboard)/features/appointments/actions";
import { startOfWeek, endOfWeek } from "date-fns";
import { serializeEntity, serializeMany } from "@/lib/utils/serialize";
import { AppointmentsClient } from "./appointments-client";

type Props = {
  searchParams: Promise<{ patientId?: string }>;
};

export default async function AppointmentsPage({ searchParams }: Props) {
  const ctx = await requireRouteAccess("appointments", "read");
  const { patientId } = await searchParams;
  const now = new Date();

  const [appointments, chairs, patients, doctors] = await Promise.all([
    getAppointments(ctx.tenant.id, {
      start: startOfWeek(now),
      end: endOfWeek(now),
    }),
    getChairs(ctx.tenant.id),
    getPatients(ctx.tenant.id),
    getDoctors(ctx.tenant.id),
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
    />
  );
}
