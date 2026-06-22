import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import {
  getChairUtilizationReport,
  getDoctorProductivityReport,
  getPatientRetentionReport,
  getRevenueByProcedureReport,
} from "@/app/(dashboard)/features/reports/queries";
import { getDashboardKPIs } from "@/app/(dashboard)/features/dashboard/queries";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const ctx = await requireRouteAccess("reports", "read");

  const [kpis, doctorProductivity, revenueByProcedure, retention, chairUtil] = await Promise.all([
    getDashboardKPIs(ctx.tenant.id),
    getDoctorProductivityReport(ctx.tenant.id, "month"),
    getRevenueByProcedureReport(ctx.tenant.id, "month"),
    getPatientRetentionReport(ctx.tenant.id, "month"),
    getChairUtilizationReport(ctx.tenant.id, "week"),
  ]);

  return (
    <ReportsClient
      kpis={kpis}
      tenantId={ctx.tenant.id}
      doctorProductivity={doctorProductivity}
      revenueByProcedure={revenueByProcedure}
      retention={retention}
      chairUtil={chairUtil}
    />
  );
}
