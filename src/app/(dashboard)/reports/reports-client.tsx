"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Download } from "lucide-react";

type KPIs = Awaited<ReturnType<typeof import("@/app/(dashboard)/features/dashboard/queries").getDashboardKPIs>>;

export function ReportsClient({ kpis, tenantId }: { kpis: KPIs; tenantId: string }) {
  function exportCsv() {
    const rows = [
      ["Metric", "Value"],
      ["Today's Appointments", kpis.todayAppointments],
      ["Completed Today", kpis.completedToday],
      ["Pending Invoices", kpis.pendingInvoices],
      ["Revenue This Month", kpis.revenueThisMonth],
      ["Chair Utilization %", kpis.chairUtilization],
      ["Patient Count", kpis.patientCount],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dentaflow-report-${tenantId.slice(0, 8)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Operational & business analytics</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Revenue (MTD)", value: formatCurrency(kpis.revenueThisMonth) },
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
    </div>
  );
}
