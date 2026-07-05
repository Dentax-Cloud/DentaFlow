export const runtime = "nodejs";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { isClinicalRole } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { serializeDecimal } from "@/lib/utils/serialize";
import { getActiveChairsideSessionsForUser } from "@/app/(dashboard)/features/clinical/chairside-actions";
import { ResumeChairsideBanner } from "@/components/clinical/resume-chairside-banner";
import DoctorDashboardClient from "./doctor-dashboard-client";

export default async function DoctorDashboardPage() {
  const ctx = await requireTenantContext();

  const staffMember = ctx.staffMember;
  if (!staffMember || !isClinicalRole(staffMember.role)) {
    redirect("/dashboard");
  }

  const doctorRecord = await db.doctor.findFirst({
    where: { userId: staffMember.id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!doctorRecord) {
    redirect("/dashboard");
  }

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0,
  );
  const todayEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
  );

  const appointments = await db.appointment.findMany({
    where: {
      tenantId: ctx.tenantId,
      doctorId: doctorRecord.id,
      deletedAt: null,
      isBlock: false,
      startTime: { gte: todayStart, lte: todayEnd },
      status: { notIn: ["CANCELED", "NO_SHOW"] },
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          patientId: true,
          patientNumber: true,
          phone: true,
          allergies: true,
          bloodGroup: true,
          insuranceProvider: true,
          insuranceNetwork: true,
          insuranceCoPayPercent: true,
        },
      },
      chair: { select: { id: true, name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const unreadNotifications = await db.notification.count({
    where: {
      tenantId: ctx.tenantId,
      recipientId: staffMember.id,
      isRead: false,
    },
  });

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weeklyStats = await db.appointment.groupBy({
    by: ["status"],
    where: {
      tenantId: ctx.tenantId,
      doctorId: doctorRecord.id,
      deletedAt: null,
      isBlock: false,
      startTime: { gte: weekStart, lte: weekEnd },
    },
    _count: { id: true },
  });

  const totalThisWeek = weeklyStats.reduce((sum, s) => sum + s._count.id, 0);

  const activeSessions = await getActiveChairsideSessionsForUser().catch(() => []);
  const resumeSessions = activeSessions.map((session) => ({
    id: session.id,
    patientId: session.patientId,
    appointmentId: session.appointmentId,
    startedAt: session.startedAt.toISOString(),
    patientName:
      `${session.patient.firstName ?? ""} ${session.patient.lastName ?? ""}`.trim() ||
      "Patient",
  }));

  return (
    <div className="space-y-4">
      {resumeSessions.length > 0 && (
        <ResumeChairsideBanner sessions={resumeSessions} compact />
      )}
      <DoctorDashboardClient
      doctorName={`${staffMember.firstName ?? ""} ${staffMember.lastName ?? ""}`.trim()}
      role={staffMember.role}
      appointments={appointments
        .filter((a) => a.patient != null)
        .map((a) => ({
        ...serializeDecimal(a),
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        patient: {
          ...serializeDecimal(a.patient!),
          insuranceCoPayPercent: a.patient!.insuranceCoPayPercent
            ? Number(a.patient!.insuranceCoPayPercent)
            : null,
        },
      }))}
      unreadCount={unreadNotifications}
      totalThisWeek={totalThisWeek}
      today={today.toISOString()}
    />
    </div>
  );
}
