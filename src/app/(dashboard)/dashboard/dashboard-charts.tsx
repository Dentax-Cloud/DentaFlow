"use client";

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
import { ChartShell } from "@/components/charts/chart-shell";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/charts/theme";
import { formatCurrency } from "@/lib/utils";
import type {
  getRevenueTrend,
  getTodayAppointmentStatusBreakdown,
  getTodayChairUtilizationByChair,
} from "@/app/(dashboard)/features/dashboard/queries";

type RevenuePoint = Awaited<ReturnType<typeof getRevenueTrend>>[number];
type ChairRow = Awaited<ReturnType<typeof getTodayChairUtilizationByChair>>[number];
type StatusSlice = Awaited<ReturnType<typeof getTodayAppointmentStatusBreakdown>>[number];

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function DashboardCharts({
  revenueTrend,
  chairUtilization,
  statusBreakdown,
  revenueThisMonth,
}: {
  revenueTrend: RevenuePoint[];
  chairUtilization: ChairRow[];
  statusBreakdown: StatusSlice[];
  revenueThisMonth: number;
}) {
  const statusTotal = statusBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <ChartShell
        className="xl:col-span-2"
        title="Revenue trend"
        description={`Last 30 days · MTD ${formatCurrency(revenueThisMonth)}`}
        table={
          <div className="max-h-48 overflow-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {revenueTrend.map((row) => (
                  <tr key={row.date} className="border-b border-border/50">
                    <td className="py-1.5 pr-4">{row.label}</td>
                    <td className="py-1.5">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        title="Today's appointments"
        description={`${statusTotal} appointment${statusTotal === 1 ? "" : "s"} today`}
        table={
          <div className="space-y-1 text-sm">
            {statusBreakdown.map((row) => (
              <div key={row.key} className="flex justify-between border-b pb-1">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: row.fill }}
                  />
                  {row.name}
                </span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))}
          </div>
        }
      >
        {statusTotal === 0 ? (
          <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No appointments scheduled today
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusBreakdown.filter((s) => s.count > 0)}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
              >
                {statusBreakdown
                  .filter((s) => s.count > 0)
                  .map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
              </Pie>
              <Tooltip
                {...CHART_TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => <span className="text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartShell>

      <ChartShell
        className="lg:col-span-2 xl:col-span-3"
        title="Chair utilization today"
        description="Booked vs available minutes per chair (10h clinic day)"
        table={
          <div className="space-y-1 text-sm">
            {chairUtilization.map((c) => (
              <div key={c.chairId} className="flex justify-between border-b pb-1">
                <span>{c.chairName}</span>
                <span>
                  {c.bookedMinutes}m booked · {c.availableMinutes}m available · {c.utilizationPercent}%
                </span>
              </div>
            ))}
          </div>
        }
      >
        {chairUtilization.length === 0 ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No active chairs configured
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, chairUtilization.length * 44)}>
            <BarChart
              data={chairUtilization}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                tickLine={false}
                axisLine={false}
                unit="m"
              />
              <YAxis
                type="category"
                dataKey="chairName"
                width={72}
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                {...CHART_TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [
                  `${value} min`,
                  name === "bookedMinutes" ? "Booked" : "Available",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="bookedMinutes"
                name="Booked"
                stackId="chair"
                fill={CHART_COLORS.primary}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="freeMinutes"
                name="Available"
                stackId="chair"
                fill={CHART_COLORS.muted}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartShell>
    </div>
  );
}
