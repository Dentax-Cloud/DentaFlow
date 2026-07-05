export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import type { PerioMeasurement } from "@/lib/clinical/types";
import { PerioPageClient } from "./perio-client";

export default async function PerioPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const { patientId } = await searchParams;
  const ctx = await requireRouteAccess("clinical_chart", "read");

  const patients = await db.patient.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
    take: 200,
  });

  const chartHistory = patientId
    ? await db.perioChart.findMany({
        where: { tenantId: ctx.tenant.id, patientId },
        orderBy: { chartDate: "desc" },
      })
    : [];

  return (
    <PerioPageClient
      patients={patients}
      selectedPatientId={patientId ?? null}
      chartHistory={chartHistory.map((c) => ({
        id: c.id,
        chartDate: c.chartDate.toISOString(),
        perioStage: c.perioStage,
        perioGrade: c.perioGrade,
        bopPercent: c.bopPercent,
        notes: c.notes,
        measurements: c.measurements as PerioMeasurement[],
      }))}
      currentStaffId={ctx.staffMember?.id ?? null}
      currentStaffName={
        ctx.staffMember
          ? `${ctx.staffMember.firstName} ${ctx.staffMember.lastName}`.trim()
          : "Provider"
      }
    />
  );
}
