import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import {
  getChairUtilizationReport,
  getDoctorProductivityReport,
  getPatientRetentionReport,
  getRevenueByProcedureReport,
  getRevenueTaxSummaryReport,
} from "@/app/(dashboard)/features/reports/queries";
import { getDashboardKPIs } from "@/app/(dashboard)/features/dashboard/queries";
import { serializeDecimal } from "@/lib/utils/serialize";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const ctx = await requireRouteAccess("reports", "read");

  const [kpis, doctorProductivity, revenueByProcedure, retention, chairUtil, taxSummary] =
    await Promise.all([
      getDashboardKPIs(ctx.tenant.id),
      getDoctorProductivityReport(ctx.tenant.id, "month"),
      getRevenueByProcedureReport(ctx.tenant.id, "month"),
      getPatientRetentionReport(ctx.tenant.id, "month"),
      getChairUtilizationReport(ctx.tenant.id, "week"),
      getRevenueTaxSummaryReport(ctx.tenant.id, "month"),
    ]);

  return (
    <ReportsClient
      kpis={serializeDecimal(kpis)}
      tenantId={ctx.tenant.id}
      countryCode={ctx.tenant.countryCode}
      doctorProductivity={doctorProductivity.map(serializeDecimal)}
      revenueByProcedure={revenueByProcedure.map(serializeDecimal)}
      retention={serializeDecimal(retention)}
      taxSummary={serializeDecimal(taxSummary)}
      chairUtil={{
        ...chairUtil,
        byChair: chairUtil.byChair.map(serializeDecimal),
      }}
    />
  );
}
