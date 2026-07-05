export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getTenantContext } from "@/lib/tenant/context";
import { isMaintenanceMode } from "@/lib/settings/platform-settings";
import {
  ACCOUNT_SETUP_INCOMPLETE_PATH,
  requireStaffMemberRole,
} from "@/lib/rbac/staff-role";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  // Superadmin ALWAYS goes to superadmin panel — no clinic dashboard
  if (session.user.isSuperAdmin) {
    redirect("/superadmin/tenants");
  }

  if (await isMaintenanceMode()) {
    redirect("/maintenance");
  }

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  if (ctx.tenant.status === "SUSPENDED" || ctx.tenant.status === "CLOSED") {
    redirect("/pending-approval");
  }

  if (!ctx.staffMember) {
    redirect(ACCOUNT_SETUP_INCOMPLETE_PATH);
  }

  const userRole = requireStaffMemberRole(ctx);

  return (
    <DashboardShell
      userRole={userRole}
      user={
        ctx.staffMember
          ? {
              firstName: ctx.staffMember.firstName,
              lastName: ctx.staffMember.lastName,
              email: ctx.staffMember.email,
              avatarUrl: ctx.staffMember.avatarUrl,
              staffRef: ctx.staffMember.staffRef,
            }
          : undefined
      }
      tenantName={ctx.tenant.name}
      tenantLogoUrl={ctx.tenant.logoUrl}
      trialDaysLeft={
        ctx.tenant.subscriptionStatus === "TRIALING"
          ? ctx.trial.trialDaysRemaining
          : null
      }
    >
      {children}
    </DashboardShell>
  );
}
