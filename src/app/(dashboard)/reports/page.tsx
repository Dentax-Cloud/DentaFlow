import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getDashboardKPIs } from "@/app/(dashboard)/features/dashboard/queries";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const ctx = await requireRouteAccess("reports", "read");
  const kpis = await getDashboardKPIs(ctx.tenant.id);

  return <ReportsClient kpis={kpis} tenantId={ctx.tenant.id} />;
}
