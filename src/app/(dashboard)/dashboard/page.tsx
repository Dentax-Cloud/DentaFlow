export const runtime = "nodejs";

import { getTenantContext } from "@/lib/tenant/context";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isClinicalRole, normalizeDashboardRole } from "@/lib/rbac/permissions";
import {
  getDashboardKPIs,
  getRoleDashboardExtras,
} from "@/app/(dashboard)/features/dashboard/queries";
import { serializeDecimal } from "@/lib/utils/serialize";
import { DashboardClient } from "./dashboard-client";
import {
  getOnboardingChecklist,
  markOnboardingComplete,
} from "@/lib/tenant/onboarding";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { getActiveChairsideSessionsForUser } from "@/app/(dashboard)/features/clinical/chairside-actions";
import { ResumeChairsideBanner } from "@/components/clinical/resume-chairside-banner";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import {
  redirectIfStaffMemberMissing,
  requireStaffMemberRole,
} from "@/lib/rbac/staff-role";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  redirectIfStaffMemberMissing(ctx);
  const userRole = requireStaffMemberRole(ctx);

  if (isClinicalRole(userRole)) {
    redirect("/dashboard/doctor");
  }

  const staffMemberId = ctx.staffMember?.id ?? null;
  const dashboardRole = normalizeDashboardRole(userRole);

  const [kpis, extras, checklist] = await Promise.all([
    dashboardRole === "STORE"
      ? Promise.resolve({
          todayAppointments: 0,
          completedToday: 0,
          pendingInvoices: 0,
          revenueThisMonth: 0,
          chairUtilization: 0,
          patientCount: 0,
          inChairNow: 0,
          totalChairs: 0,
          emergencyWaiting: 0,
          emergencyImmediate: 0,
        })
      : getDashboardKPIs(ctx.tenant.id),
    getRoleDashboardExtras(ctx.tenant.id, userRole, staffMemberId),
    getOnboardingChecklist(ctx.tenant),
  ]);

  if (checklist.allComplete && !ctx.tenant.onboardingCompleted) {
    await markOnboardingComplete(ctx.tenant.id);
  }

  const canSeeChairsideSessions =
    ctx.staffMember?.role &&
    hasPermission(ctx.staffMember.role, PERMISSIONS.clinical_chart.read);
  const activeSessions =
    canSeeChairsideSessions
      ? await getActiveChairsideSessionsForUser().catch(() => [])
      : [];
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
    <div className="space-y-6">
      {resumeSessions.length > 0 && (
        <ResumeChairsideBanner sessions={resumeSessions} compact />
      )}
      {checklist.showChecklist && (
        <OnboardingChecklist items={checklist.items} compact />
      )}
      <DashboardClient
        kpis={serializeDecimal(kpis)}
        extras={extras}
        tenantName={ctx.tenant.name}
        plan={ctx.tenant.subscriptionPlan}
        userRole={userRole}
        staffMemberId={staffMemberId}
      />
    </div>
  );
}
