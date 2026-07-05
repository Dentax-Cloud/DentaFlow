export const runtime = "nodejs";

import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { buildDefaultWeeklySchedule } from "@/lib/appointments/default-doctor-schedule";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import DoctorScheduleClient from "./doctor-schedule-client";

export default async function DoctorSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.admin.users);

  const doctor = await db.staffMember.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
      role: { in: ["DOCTOR", "DENTIST", "HYGIENIST"] },
      deletedAt: null,
    },
  });

  if (!doctor) notFound();

  const schedule = await db.doctorSchedule.findMany({
    where: { tenantId: ctx.tenantId, doctorId: id },
    orderBy: { dayOfWeek: "asc" },
  });

  const exceptions = await db.doctorScheduleException.findMany({
    where: {
      tenantId: ctx.tenantId,
      doctorId: id,
      date: {
        gte: new Date().toISOString().split("T")[0],
      },
    },
    orderBy: { date: "asc" },
  });

  const fullSchedule = buildDefaultWeeklySchedule().map((day) => {
    const existing = schedule.find((s) => s.dayOfWeek === day.dayOfWeek);
    return existing ?? { ...day, maxAppointments: null };
  });

  return (
    <DoctorScheduleClient
      doctorId={id}
      doctorName={`Dr. ${doctor.firstName ?? ""} ${doctor.lastName ?? ""}`.trim()}
      schedule={fullSchedule.map((s) => ({
        ...s,
        breaks: s.breaks as Array<{ start: string; end: string }>,
      }))}
      exceptions={exceptions.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
