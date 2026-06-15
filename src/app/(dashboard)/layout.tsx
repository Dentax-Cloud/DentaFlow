export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { resolvePostAuthDestination } from "@/lib/auth/registration-status";
import { getTenantContext } from "@/lib/tenant/context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  if (!orgId) {
    redirect(await resolvePostAuthDestination(userId, orgId));
  }

  const ctx = await getTenantContext();
  if (ctx && !ctx.isSuperAdmin) {
    if (!ctx.tenant.onboardingCompleted) {
      redirect("/sign-up");
    }
    if (ctx.tenant.status === "PENDING") redirect("/pending-approval");
    if (ctx.tenant.status !== "ACTIVE") redirect("/pending-approval");
  }

  const userRole = ctx?.user.role ?? UserRole.RECEPTIONIST;

  return (
    <DashboardShell
      userRole={userRole}
      user={
        ctx?.user
          ? {
              firstName: ctx.user.firstName,
              lastName: ctx.user.lastName,
              email: ctx.user.email,
              avatarUrl: ctx.user.avatarUrl,
            }
          : undefined
      }
      isSuperAdmin={ctx?.isSuperAdmin ?? false}
      tenantName={ctx?.tenant.name}
      tenantLogoUrl={ctx?.tenant.logoUrl}
    >
      {children}
    </DashboardShell>
  );
}
