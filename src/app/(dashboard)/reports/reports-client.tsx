"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/countries";
import { Download } from "lucide-react";
import type {
  getChairUtilizationReport,
  getDoctorProductivityReport,
  getPatientRetentionReport,
  getRevenueByProcedureReport,
  getRevenueTaxSummaryReport,
} from "@/app/(dashboard)/features/reports/queries";

type KPIs = Awaited<ReturnType<typeof import("@/app/(dashboard)/features/dashboard/queries").getDashboardKPIs>>;
type DoctorRow = Awaited<ReturnType<typeof getDoctorProductivityReport>>[number];
type ProcedureRow = Awaited<ReturnType<typeof getRevenueByProcedureReport>>[number];
type Retention = Awaited<ReturnType<typeof getPatientRetentionReport>>;
type ChairUtil = Awaited<ReturnType<typeof getChairUtilizationReport>>;
type TaxSummary = Awaited<ReturnType<typeof getRevenueTaxSummaryReport>>;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "doctors", label: "Doctor productivity" },
  { id: "procedures", label: "Revenue by procedure" },
  { id: "tax", label: "Tax / GST" },
  { id: "retention", label: "Patient retention" },
  { id: "chairs", label: "Chair utilization" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ReportsClient({
  kpis,
  tenantId,
  countryCode,
  doctorProductivity,
  revenueByProcedure,
  retention,
  chairUtil,
  taxSummary,
}: {
  kpis: KPIs;
  tenantId: string;
  countryCode: string;
  doctorProductivity: DoctorRow[];
  revenueByProcedure: ProcedureRow[];
  retention: Retention;
  chairUtil: ChairUtil;
  taxSummary: TaxSummary;
}) {
  const money = (amount: number) => formatCurrency(amount, countryCode);
  const [tab, setTab] = useState<TabId>("overview");

  function exportCsv(filename: string, rows: string[][]) {
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  function exportOverview() {
    exportCsv(`dentaflow-overview-${tenantId.slice(0, 8)}.csv`, [
      ["Metric", "Value"],
      ["Today's Appointments", String(kpis.todayAppointments)],
      ["Completed Today", String(kpis.completedToday)],
      ["Pending Invoices", String(kpis.pendingInvoices)],
      ["Revenue This Month", String(kpis.revenueThisMonth)],
      ["Chair Utilization %", String(kpis.chairUtilization)],
      ["Patient Count", String(kpis.patientCount)],
    ]);
  }

  function exportDoctors() {
    exportCsv(`doctor-productivity-${tenantId.slice(0, 8)}.csv`, [
      ["Doctor", "Appointments Completed", "Revenue"],
      ...doctorProductivity.map((d) => [
        d.doctorName,
        String(d.appointmentsCompleted),
        String(d.revenue),
      ]),
    ]);
  }

  function exportProcedures() {
    exportCsv(`revenue-procedures-${tenantId.slice(0, 8)}.csv`, [
      ["Procedure", "Count", "Total Revenue", "Tax", "Average"],
      ...revenueByProcedure.map((p) => [
        p.name,
        String(p.count),
        String(p.totalRevenue),
        String(p.taxCollected ?? 0),
        String(Math.round(p.averagePerVisit)),
      ]),
    ]);
  }

  function exportTax() {
    exportCsv(`tax-summary-${tenantId.slice(0, 8)}.csv`, [
      ["Metric", "Value"],
      ["Invoices", String(taxSummary.invoiceCount)],
      ["Subtotal", String(taxSummary.subtotal)],
      ["Tax", String(taxSummary.tax)],
      ["Total", String(taxSummary.total)],
      ["CGST", String(taxSummary.cgst)],
      ["SGST", String(taxSummary.sgst)],
      ["IGST", String(taxSummary.igst)],
      ["Exempt subtotal", String(taxSummary.exemptSubtotal)],
      ["Taxable subtotal", String(taxSummary.taxableSubtotal)],
    ]);
  }

  const topProcedure = revenueByProcedure[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Operational & business analytics</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (tab === "doctors") exportDoctors();
            else if (tab === "procedures") exportProcedures();
            else if (tab === "tax") exportTax();
            else exportOverview();
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Revenue (MTD)", value: money(kpis.revenueThisMonth) },
            { label: "Patients", value: kpis.patientCount },
            { label: "Chair utilization", value: `${kpis.chairUtilization}%` },
            { label: "Appointments today", value: kpis.todayAppointments },
            { label: "Completed today", value: kpis.completedToday },
            { label: "Pending invoices", value: kpis.pendingInvoices },
          ].map((item) => (
            <Card key={item.label}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "doctors" && (
        <Card>
          <CardHeader>
            <CardTitle>Doctor productivity (this month)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {doctorProductivity.length === 0 && (
              <p className="text-sm text-muted-foreground">No completed appointments this period.</p>
            )}
            {doctorProductivity.map((d) => (
              <div key={d.doctorId} className="flex justify-between border-b pb-2 text-sm">
                <span className="font-medium">{d.doctorName}</span>
                <span>
                  {d.appointmentsCompleted} appts · {money(d.revenue)} invoiced
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "procedures" && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue by procedure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProcedure && (
              <p className="mb-4 text-sm text-muted-foreground">
                Most profitable:{" "}
                <Badge variant="success">{topProcedure.name}</Badge> —{" "}
                {money(topProcedure.totalRevenue)}
              </p>
            )}
            {revenueByProcedure.map((p) => (
              <div key={p.name} className="flex justify-between border-b pb-2 text-sm">
                <span>{p.name}</span>
                <span>
                  ×{p.count} · {money(p.totalRevenue)}
                  {(p.taxCollected ?? 0) > 0 ? ` · tax ${money(p.taxCollected)}` : ""} · avg{" "}
                  {money(p.averagePerVisit)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "tax" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Invoices (MTD)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{taxSummary.invoiceCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Revenue total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{money(taxSummary.total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {taxSummary.taxName ? `${taxSummary.taxName} collected` : "Tax collected"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{money(taxSummary.tax)}</p>
            </CardContent>
          </Card>
          {taxSummary.hasGstBreakdown ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">CGST</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{money(taxSummary.cgst)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">SGST</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{money(taxSummary.sgst)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">IGST</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{money(taxSummary.igst)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Exempt services</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{money(taxSummary.exemptSubtotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Taxable goods</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{money(taxSummary.taxableSubtotal)}</p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-6 text-sm text-muted-foreground">
                No GST breakdown for this period (VAT / no India GST line items). Tax total above uses
                invoice.tax.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "retention" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">New patients</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{retention.newPatients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Returning patients</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{retention.returningPatients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Overdue recalls</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-destructive">{retention.overdueRecalls}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avg days between visits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{retention.averageDaysBetweenVisits}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "chairs" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chair utilization (this week)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {chairUtil.byChair.map((c) => (
                <div key={c.chairId} className="flex justify-between border-b pb-2 text-sm">
                  <span>{c.chairName}</span>
                  <span>
                    {c.hoursBooked}h booked · {c.utilizationPercent}% utilization
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Peak hours heatmap</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="p-1" />
                    {Array.from({ length: 12 }, (_, i) => i + 8).map((h) => (
                      <th key={h} className="p-1 text-muted-foreground">
                        {h}:00
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_NAMES.map((day, dayIdx) => (
                    <tr key={day}>
                      <td className="p-1 font-medium">{day}</td>
                      {Array.from({ length: 12 }, (_, i) => i + 8).map((hour) => {
                        const count = chairUtil.heatmap[String(dayIdx)]?.[hour] ?? 0;
                        const intensity = Math.min(1, count / 5);
                        return (
                          <td key={hour} className="p-0.5">
                            <div
                              className="h-6 w-8 rounded"
                              style={{
                                backgroundColor: `rgba(14, 165, 233, ${intensity * 0.9 + 0.05})`,
                              }}
                              title={`${count} appointments`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
