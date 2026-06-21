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

  if (session.user.isSuperAdmin) redirect("/superadmin/tenants");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  if (!ctx.tenant.onboardingCompleted) redirect("/sign-up");
  if (ctx.tenant.status === "PENDING") redirect("/pending-approval");
  if (ctx.tenant.status !== "ACTIVE") redirect("/pending-approval");

  const userRole = ctx.staffMember?.role ?? UserRole.RECEPTIONIST;

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
      tenantName={ctx.tenant.name}
      tenantLogoUrl={ctx.tenant.logoUrl}
    >
      {children}
    </DashboardShell>
  );
}
