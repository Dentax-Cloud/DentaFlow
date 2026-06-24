export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getTenantContext } from "@/lib/tenant/context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  // Superadmin without active impersonation → go to superadmin panel
  if (session.user.isSuperAdmin && !session.user.activeTenantId) {
    redirect("/superadmin/tenants");
  }

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  if (!session.user.isSuperAdmin) {
    if (ctx.tenant.status === "SUSPENDED" || ctx.tenant.status === "CLOSED") {
      redirect("/pending-approval");
    }
  }

  const userRole = ctx.staffMember?.role ?? UserRole.ADMIN;

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
            }
          : undefined
      }
      isSuperAdmin={ctx.isSuperAdmin}
      isImpersonating={session.user.isSuperAdmin && Boolean(session.user.activeTenantId)}
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
