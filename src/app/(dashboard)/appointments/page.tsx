import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPrimaryInsuranceStatusMap } from "@/app/(dashboard)/features/insurance/insurance-policy-actions";
import { getAppointments, getChairs, getDoctors } from "@/app/(dashboard)/features/appointments/actions";
import { db } from "@/lib/db";
import { startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { serializeEntity, serializeMany } from "@/lib/utils/serialize";
import { AppointmentsClient } from "./appointments-client";

type Props = {
  searchParams: Promise<{ appointmentId?: string }>;
};

export default async function AppointmentsPage({ searchParams }: Props) {
  const ctx = await requireRouteAccess("appointments", "read");
  const { appointmentId } = await searchParams;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const [appointments, chairs, doctors, emergencyStats, insuranceStatusMap] = await Promise.all([
    getAppointments({
      start: weekStart,
      end: endOfWeek(now, { weekStartsOn: 1 }),
    }),
    getChairs(),
    getDoctors(),
    db.emergencyIntake.findMany({
      where: {
        tenantId: ctx.tenant.id,
        createdAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { notIn: ["COMPLETED", "REFERRED"] },
      },
      select: { status: true, triageLevel: true },
    }),
    getPrimaryInsuranceStatusMap(),
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
      doctors={doctors.map((doctor) => serializeEntity(doctor, { user: "object" }))}
      tenantId={ctx.tenant.id}
      clinicTimezone={ctx.tenant.timezone ?? "Asia/Dubai"}
      initialAppointmentId={appointmentId}
      emergencyWaiting={emergencyStats.filter((e) => e.status === "WAITING").length}
      emergencyImmediate={emergencyStats.filter((e) => e.triageLevel === "IMMEDIATE").length}
      insuranceStatusMap={insuranceStatusMap}
      staffRole={ctx.staffMember?.role}
      loadedWeekStart={weekStart.toISOString()}
    />
  );
}
