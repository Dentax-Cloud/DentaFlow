import { getTenantContext } from "@/lib/tenant/context";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getDashboardKPIs,
  getRoleDashboardExtras,
} from "@/app/(dashboard)/features/dashboard/queries";
import { DashboardClient } from "./dashboard-client";
import {
  getOnboardingChecklist,
  markOnboardingComplete,
} from "@/lib/tenant/onboarding";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  const userRole = ctx.staffMember?.role ?? "RECEPTIONIST";
  const staffMemberId = ctx.staffMember?.id ?? null;

  const [kpis, extras, checklist] = await Promise.all([
    getDashboardKPIs(ctx.tenant.id),
    getRoleDashboardExtras(ctx.tenant.id, userRole, staffMemberId),
    getOnboardingChecklist(ctx.tenant),
  ]);

  if (checklist.allComplete && !ctx.tenant.onboardingCompleted) {
    await markOnboardingComplete(ctx.tenant.id);
  }

  return (
    <div className="space-y-6">
      {checklist.showChecklist && <OnboardingChecklist items={checklist.items} compact />}
      <DashboardClient
        kpis={kpis}
        extras={extras}
        tenantName={ctx.tenant.name}
        plan={ctx.tenant.subscriptionPlan}
        userRole={userRole}
        staffMemberId={staffMemberId}
      />
    </div>
  );
}
