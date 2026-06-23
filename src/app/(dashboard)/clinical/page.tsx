import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { ClinicalPageClient } from "./clinical-client";

export default async function ClinicalPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; appointmentId?: string }>;
}) {
  const { patientId, appointmentId } = await searchParams;
  const ctx = await requireRouteAccess("clinical", "read");

  const patients = await db.patient.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    orderBy: { lastName: "asc" },
    take: 100,
    select: { id: true, firstName: true, lastName: true, patientNumber: true },
  });

  let chartData: import("@/lib/clinical/chart-types").ToothChartData = {};
  if (patientId) {
    const patient = await db.patient.findFirst({
      where: { tenantId: ctx.tenant.id, id: patientId, deletedAt: null },
    });
    if (patient) {
      const teeth = await db.tooth.findMany({
        where: { tenantId: ctx.tenant.id, patientId: patient.id },
        include: { conditions: { orderBy: { recordedAt: "desc" } } },
      });
      for (const tooth of teeth) {
        if (tooth.conditions.length === 0) continue;
        chartData[tooth.number] = {
          conditions: tooth.conditions.map((c) => ({
            id: c.id,
            type: c.type,
            surfaces: c.surfaces,
            severity: c.severity,
            notes: c.notes,
            recordedAt: c.recordedAt.toISOString(),
          })),
        };
      }
    }
  }

  const procedures = await db.procedureCatalog.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    orderBy: { name: "asc" },
  });

  const serializedProcedures = procedures.map(serializeDecimal);

  return (
    <ClinicalPageClient
      patients={patients}
      selectedPatientId={patientId}
      appointmentId={appointmentId}
      procedures={serializedProcedures}
      initialChartData={chartData}
    />
  );
}
