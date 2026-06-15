import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { getAppointments, getChairs, getDoctors } from "@/app/(dashboard)/features/appointments/actions";
import { startOfWeek, endOfWeek } from "date-fns";
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

  return (
    <AppointmentsClient
      initialAppointments={appointments}
      chairs={chairs}
      patients={patients}
      doctors={doctors}
      tenantId={ctx.tenant.id}
      defaultPatientId={patientId}
    />
  );
}
