import Link from "next/link";
import { db } from "@/lib/db";
import { SubscriptionStatus, TenantStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformAnalytics } from "@/lib/super-admin/queries";
import { formatCurrency } from "@/lib/utils";

const PLAN_MRR: Record<string, number> = {
  STARTER: 49,
  PROFESSIONAL: 149,
  ENTERPRISE: 399,
};

export default async function SuperadminDashboardPage() {
  const analytics = await getPlatformAnalytics();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [recentSignups, overduePayments, trialingCount] = await Promise.all([
    db.tenant.count({
      where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } },
    }),
    db.tenant.count({
      where: {
        deletedAt: null,
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
      },
    }),
    db.tenant.count({
      where: {
        deletedAt: null,
        subscriptionStatus: SubscriptionStatus.TRIALING,
      },
    }),
  ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const appointmentsThisMonth = await db.appointment.count({
    where: { deletedAt: null, startTime: { gte: monthStart } },
  });

  const mrrEstimate = Object.entries(analytics.planBreakdown).reduce(
    (sum, [plan, count]) => sum + (PLAN_MRR[plan] ?? 0) * count,
    0,
  );

  const pendingApprovals = await db.tenant.count({
    where: { deletedAt: null, status: TenantStatus.PENDING },
  });

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
            value: analytics.activeTenants,
            sub: `${trialingCount} trialing`,
          },
          { label: "Total patients", value: analytics.totalPatients },
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
        <Card className="border-white/10 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-sm">Pending approval</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold">{pendingApprovals}</p>
            {pendingApprovals > 0 && (
              <Badge variant="warning">{pendingApprovals} waiting</Badge>
            )}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-sm">Overdue payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-400">{overduePayments}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle>Plan distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {Object.entries(analytics.planBreakdown).map(([plan, count]) => (
            <div key={plan} className="rounded-lg border border-white/10 px-4 py-2">
              <p className="text-xs text-zinc-500">{plan}</p>
              <p className="text-xl font-bold">{count}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
