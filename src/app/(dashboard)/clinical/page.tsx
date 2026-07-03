export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { getPatientChart } from "@/app/(dashboard)/features/clinical/actions";
import { listTemplates } from "@/app/(dashboard)/features/clinical/template-actions";
import { getActiveChairsideSessionsForUser } from "@/app/(dashboard)/features/clinical/chairside-actions";
import { ResumeChairsideBanner } from "@/components/clinical/resume-chairside-banner";
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
      chartData = await getPatientChart(ctx.tenant.id, patient.id);
    }
  }

  const procedures = await db.procedureCatalog.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    orderBy: { name: "asc" },
  });

  const providerName = ctx.staffMember
    ? `${ctx.staffMember.firstName} ${ctx.staffMember.lastName}`.trim()
    : undefined;

  const serializedProcedures = procedures.map(serializeDecimal);

  const templatesResult = await listTemplates({});
  const templates = templatesResult.success
    ? templatesResult.data.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        isDefault: t.isDefault,
      }))
    : [];

  const activeSessions = await getActiveChairsideSessionsForUser().catch(() => []);
  const resumeSessions = activeSessions.map((session) => ({
    id: session.id,
    patientId: session.patientId,
    appointmentId: session.appointmentId,
    startedAt: session.startedAt.toISOString(),
    patientName:
      `${session.patient.firstName ?? ""} ${session.patient.lastName ?? ""}`.trim() ||
      "Patient",
  }));

  return (
    <div className="space-y-4">
      {resumeSessions.length > 0 && <ResumeChairsideBanner sessions={resumeSessions} />}
      <ClinicalPageClient
      patients={patients}
      selectedPatientId={patientId}
      appointmentId={appointmentId}
      procedures={serializedProcedures}
      initialChartData={chartData}
      providerName={providerName}
      clinicName={ctx.tenant.name}
      templates={templates}
    />
    </div>
  );
}
