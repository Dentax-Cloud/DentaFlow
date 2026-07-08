"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartShell } from "@/components/charts/chart-shell";
import { CHART_COLORS, CHART_SERIES_PALETTE, CHART_TOOLTIP_STYLE } from "@/lib/charts/theme";
import { formatCurrency } from "@/lib/utils";
import type {
  getDoctorProductivityReport,
  getPayerMixReport,
  getProcedureVolumeTrend,
  getRevenueByProcedureReport,
  getRevenueTaxSummaryReport,
} from "@/app/(dashboard)/features/reports/queries";

type DoctorRow = Awaited<ReturnType<typeof getDoctorProductivityReport>>[number];
type ProcedureRow = Awaited<ReturnType<typeof getRevenueByProcedureReport>>[number];
type VolumePoint = Awaited<ReturnType<typeof getProcedureVolumeTrend>>[number];
type PayerRow = Awaited<ReturnType<typeof getPayerMixReport>>[number];
type TaxSummary = Awaited<ReturnType<typeof getRevenueTaxSummaryReport>>;

function truncateLabel(name: string, max = 22) {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

export function DoctorProductivityChart({ data }: { data: DoctorRow[] }) {
  const chartData = data.map((d) => ({
    name: truncateLabel(d.doctorName, 16),
    fullName: d.doctorName,
    revenue: d.revenue,
    appointments: d.appointmentsCompleted,
  }));

  return (
    <ChartShell
      title="Doctor productivity"
      description="Completed appointments and invoiced revenue (this month)"
      table={
        <div className="space-y-1 text-sm">
          {data.map((d) => (
            <div key={d.doctorId} className="flex justify-between border-b pb-1">
              <span>{d.doctorName}</span>
              <span>
                {d.appointmentsCompleted} appts · {formatCurrency(d.revenue)}
              </span>
            </div>
          ))}
        </div>
      }
    >
      {chartData.length === 0 ? (
        <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          No completed appointments this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
              angle={-28}
              textAnchor="end"
              height={56}
              interval={0}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                name === "revenue" ? formatCurrency(value) : value,
                name === "revenue" ? "Revenue" : "Appointments",
              ]}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullName ?? ""
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            <Bar
              yAxisId="right"
              dataKey="appointments"
              name="Appointments"
              fill={CHART_COLORS.primaryMuted}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function RevenueByProcedureChart({ data }: { data: ProcedureRow[] }) {
  const top = data.slice(0, 10).map((p) => ({
    name: truncateLabel(p.name, 20),
    fullName: p.name,
    revenue: Math.round(p.totalRevenue),
    count: p.count,
  }));

  return (
    <ChartShell
      title="Revenue by procedure"
      description="Top procedures by invoiced revenue (this month)"
      table={
        <div className="space-y-1 text-sm">
          {data.map((p) => (
            <div key={p.name} className="flex justify-between border-b pb-1">
              <span>{p.name}</span>
              <span>
                ×{p.count} · {formatCurrency(p.totalRevenue)}
              </span>
            </div>
          ))}
        </div>
      }
    >
      {top.length === 0 ? (
        <p className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
          No procedure revenue this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} tickFormatter={(v) => formatCurrency(v)} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
            />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value: number) => [formatCurrency(value), "Revenue"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Bar dataKey="revenue" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function ProcedureVolumeTrendChart({ data }: { data: VolumePoint[] }) {
  return (
    <ChartShell
      title="Procedure volume over time"
      description="Invoice line items per month (last 6 months)"
      table={
        <div className="space-y-1 text-sm">
          {data.map((row) => (
            <div key={row.month} className="flex justify-between border-b pb-1">
              <span>{row.label}</span>
              <span>{row.volume} procedures</span>
            </div>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axis }} width={40} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [v, "Procedures"]} />
          <Line
            type="monotone"
            dataKey="volume"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.primary }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function PayerMixChart({ data }: { data: PayerRow[] }) {
  return (
    <ChartShell
      title="Payer mix"
      description="Revenue share by insurer vs self-pay (this month)"
      table={
        <div className="space-y-1 text-sm">
          {data.map((row) => (
            <div key={row.name} className="flex justify-between border-b pb-1">
              <span>{row.name}</span>
              <span>{formatCurrency(row.revenue)}</span>
            </div>
          ))}
        </div>
      }
    >
      {data.length === 0 ? (
        <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
          No invoiced revenue this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={88}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_SERIES_PALETTE[i % CHART_SERIES_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value: number) => [formatCurrency(value), "Revenue"]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

export function GstBreakdownChart({ taxSummary }: { taxSummary: TaxSummary }) {
  if (!taxSummary.hasGstBreakdown) return null;

  const chartData = [
    {
      name: "Exempt",
      exempt: taxSummary.exemptSubtotal,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    },
    {
      name: "Taxable",
      exempt: 0,
      taxable: taxSummary.taxableSubtotal,
      cgst: taxSummary.cgst,
      sgst: taxSummary.sgst,
      igst: taxSummary.igst,
    },
  ];

  return (
    <ChartShell
      title="GST breakdown"
      description="Exempt vs taxable revenue and tax components (India)"
      table={
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["CGST", taxSummary.cgst],
            ["SGST", taxSummary.sgst],
            ["IGST", taxSummary.igst],
            ["Exempt services", taxSummary.exemptSubtotal],
            ["Taxable goods", taxSummary.taxableSubtotal],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between border-b pb-1">
              <span>{label}</span>
              <span>{formatCurrency(Number(value))}</span>
            </div>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axis }} tickFormatter={(v) => formatCurrency(v)} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="exempt" name="Exempt" stackId="a" fill="#94a3b8" />
          <Bar dataKey="taxable" name="Taxable subtotal" stackId="a" fill={CHART_COLORS.primaryMuted} />
          <Bar dataKey="cgst" name="CGST" stackId="b" fill="#6366f1" />
          <Bar dataKey="sgst" name="SGST" stackId="b" fill="#8b5cf6" />
          <Bar dataKey="igst" name="IGST" stackId="b" fill="#a855f7" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
