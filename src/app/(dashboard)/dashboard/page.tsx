import { getTenantContext } from "@/lib/tenant/context";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getDashboardKPIs,
  getRoleDashboardExtras,
} from "@/app/(dashboard)/features/dashboard/queries";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  const userRole = ctx.staffMember?.role ?? "RECEPTIONIST";
  const staffMemberId = ctx.staffMember?.id ?? null;

  const [kpis, extras] = await Promise.all([
    getDashboardKPIs(ctx.tenant.id),
    getRoleDashboardExtras(ctx.tenant.id, userRole, staffMemberId),
  ]);

  return (
    <DashboardClient
      kpis={kpis}
      extras={extras}
      tenantName={ctx.tenant.name}
      plan={ctx.tenant.subscriptionPlan}
      userRole={userRole}
      staffMemberId={staffMemberId}
    />
  );
}
