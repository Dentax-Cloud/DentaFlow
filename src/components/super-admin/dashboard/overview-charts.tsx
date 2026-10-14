"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TenantStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TenantListItem } from "@/lib/super-admin/queries";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  PLAN_COLORS,
  PLAN_ORDER,
  SEQUENTIAL_BLUE,
  STATUS_COLORS,
  STATUS_ORDER,
} from "@/lib/super-admin/chart-colors";

const tooltipStyle = {
  background: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: 8,
  fontSize: 12,
};
const tooltipLabelStyle = { color: "#f0efec" };
const tooltipItemStyle = { color: "#c3c2b7" };
const axisTick = { fill: CHART_AXIS_TEXT, fontSize: 12 };

const STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  SUSPENDED: "Suspended",
  CLOSED: "Closed",
};

export function OverviewCharts({ tenants }: { tenants: TenantListItem[] }) {
  const signupTrend = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), label: format(d, "MMM d"), count: 0 });
    }
    const indexByDate = new Map(days.map((d, i) => [d.date, i]));
    for (const t of tenants) {
      const created = new Date(t.createdAt);
      created.setHours(0, 0, 0, 0);
      const idx = indexByDate.get(created.toISOString().slice(0, 10));
      if (idx !== undefined) days[idx].count += 1;
    }
    return days;
  }, [tenants]);

  const planBreakdown = useMemo(() => {
    const counts = new Map<SubscriptionPlan, number>(PLAN_ORDER.map((p) => [p, 0]));
    for (const t of tenants) counts.set(t.subscriptionPlan, (counts.get(t.subscriptionPlan) ?? 0) + 1);
    return PLAN_ORDER.map((plan) => ({ plan, name: plan, value: counts.get(plan) ?? 0 }));
  }, [tenants]);

  const statusBreakdown = useMemo(() => {
    const counts = new Map<TenantStatus, number>(STATUS_ORDER.map((s) => [s, 0]));
    for (const t of tenants) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    return STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      value: counts.get(status) ?? 0,
    }));
  }, [tenants]);

  const topCountries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tenants) {
      const key = t.country?.trim() || "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6).map(([country, value]) => ({ country, value }));
    const restTotal = sorted.slice(6).reduce((sum, [, count]) => sum + count, 0);
    if (restTotal > 0) top.push({ country: "Other", value: restTotal });
    return top;
  }, [tenants]);

  const totalSignupsInWindow = signupTrend.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-sm">Signups — last 30 days</CardTitle>
          <p className="text-xs text-zinc-500">{totalSignupsInWindow} new tenants in this window</p>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signupTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={{ stroke: CHART_GRID }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => [`${value} signups`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={SEQUENTIAL_BLUE}
                  strokeWidth={2}
                  fill="url(#signupFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 text-xs text-zinc-500">
            <summary className="cursor-pointer select-none hover:text-zinc-300">View as table</summary>
            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-white/10">
              <table className="w-full tabular-nums">
                <tbody>
                  {signupTrend.map((d) => (
                    <tr key={d.date} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-1 text-zinc-400">{d.label}</td>
                      <td className="px-2 py-1 text-right text-zinc-300">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-sm">Tenants by plan</CardTitle>
          <p className="text-xs text-zinc-500">{tenants.length} total tenants</p>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={84}
                  paddingAngle={2}
                  stroke="none"
                >
                  {planBreakdown.map((entry) => (
                    <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  formatter={(value: string) => <span className="text-xs text-zinc-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 text-xs text-zinc-500">
            <summary className="cursor-pointer select-none hover:text-zinc-300">View as table</summary>
            <div className="mt-2 rounded border border-white/10">
              <table className="w-full tabular-nums">
                <tbody>
                  {planBreakdown.map((d) => (
                    <tr key={d.plan} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-1 text-zinc-400">{d.plan}</td>
                      <td className="px-2 py-1 text-right text-zinc-300">{d.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-sm">Tenants by status</CardTitle>
          <p className="text-xs text-zinc-500">Across the whole platform</p>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusBreakdown}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24} label={{ position: "right", fill: CHART_AXIS_TEXT, fontSize: 12 }}>
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-sm">Top countries</CardTitle>
          <p className="text-xs text-zinc-500">By number of tenants</p>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCountries}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="country"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar
                  dataKey="value"
                  fill={SEQUENTIAL_BLUE}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  label={{ position: "right", fill: CHART_AXIS_TEXT, fontSize: 12 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
