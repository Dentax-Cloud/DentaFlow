import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getDashboardKPIs } from "@/app/(dashboard)/features/dashboard/queries";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";
import { getRoleHomePath } from "@/lib/rbac/routes";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const ctx = await requireRouteAccess("reports", "read");
  const dashboardRole = normalizeDashboardRole(ctx.user.role);

  if (dashboardRole !== "ADMIN") {
    redirect(getRoleHomePath(ctx.user.role));
  }

  const kpis = await getDashboardKPIs(ctx.tenant.id);

  return (
    <DashboardClient
      kpis={kpis}
      tenantName={ctx.tenant.name}
      plan={ctx.tenant.subscriptionPlan}
    />
  );
}
