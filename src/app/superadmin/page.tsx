import Link from "next/link";
import { db } from "@/lib/db";
import { SubscriptionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listTenantsWithStats } from "@/lib/super-admin/queries";
import { formatCurrency } from "@/lib/utils";
import { OverviewCharts } from "@/components/super-admin/dashboard/overview-charts";

export const runtime = "nodejs";

const PLAN_MRR: Record<string, number> = {
  STARTER: 49,
  PROFESSIONAL: 149,
  ENTERPRISE: 399,
};

export default async function SuperadminDashboardPage() {
  const tenants = await listTenantsWithStats();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [overduePayments, appointmentsThisMonth] = await Promise.all([
    db.tenant.count({
      where: { deletedAt: null, subscriptionStatus: SubscriptionStatus.PAST_DUE },
    }),
    db.appointment.count({
      where: { deletedAt: null, startTime: { gte: monthStart } },
    }),
  ]);

  const activeTenants = tenants.filter((t) => t.status === "ACTIVE").length;
  const pendingApprovals = tenants.filter((t) => t.status === "PENDING").length;
  const trialingCount = tenants.filter((t) => t.subscriptionStatus === "TRIALING").length;
  const recentSignups = tenants.filter((t) => t.createdAt >= sevenDaysAgo).length;
  const totalPatients = tenants.reduce((sum, t) => sum + t.totalPatients, 0);

  const planCounts = tenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.subscriptionPlan] = (acc[t.subscriptionPlan] ?? 0) + 1;
    return acc;
  }, {});
  const mrrEstimate = Object.entries(planCounts).reduce(
    (sum, [plan, count]) => sum + (PLAN_MRR[plan] ?? 0) * count,
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Platform overview</h2>
          <p className="text-sm text-zinc-400">Cross-tenant KPIs and health metrics</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/superadmin/tenants">Manage tenants</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active tenants",
            value: activeTenants,
            sub: `${trialingCount} trialing`,
          },
          { label: "Total patients", value: totalPatients },
          { label: "Appointments (MTD)", value: appointmentsThisMonth },
          { label: "Est. MRR", value: formatCurrency(mrrEstimate) },
        ].map((item) => (
          <Card key={item.label} className="border-white/10 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{item.value}</p>
              {item.sub && <p className="text-xs text-zinc-500">{item.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-sm">Recent signups (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{recentSignups}</p>
          </CardContent>
        </Card>
        <Link href="/superadmin/tenants?status=PENDING" className="block">
          <Card className="h-full border-white/10 bg-zinc-900/50 transition-colors hover:border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-sm">Pending approval</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-3xl font-bold">{pendingApprovals}</p>
              {pendingApprovals > 0 && <Badge variant="warning">{pendingApprovals} waiting</Badge>}
            </CardContent>
          </Card>
        </Link>
        <Card className="border-white/10 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-sm">Overdue payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-400">{overduePayments}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Platform analytics</h3>
        <OverviewCharts tenants={tenants} />
      </div>
    </div>
  );
}
