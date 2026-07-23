export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { getPatientChart } from "@/app/(dashboard)/features/clinical/actions";
import { listTemplates } from "@/app/(dashboard)/features/clinical/template-actions";
import { getActiveChairsideSessionsForUser } from "@/app/(dashboard)/features/clinical/chairside-actions";
import { getEncounterQueueAppointments } from "@/lib/clinical/encounter-queue";
import { encounterWorkspacePath } from "@/lib/clinical/encounter-url";
import { ResumeChairsideBanner } from "@/components/clinical/resume-chairside-banner";
import { BackToSpineEncounterBanner } from "@/components/clinical/back-to-spine-encounter-banner";
import { EncounterQueuePanel } from "@/components/clinical/encounter-queue-panel";
import { ClinicalBrowseLinks } from "@/components/clinical/clinical-browse-links";
import { ClinicalPageClient } from "./clinical-client";
import { findOpenUnbilledEncounterForPatient } from "@/lib/encounter/legacy-invoice-guard";

export default async function ClinicalPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    appointmentId?: string;
    fromSpine?: string;
    returnAppointmentId?: string;
  }>;
}) {
  const { patientId, appointmentId, fromSpine, returnAppointmentId } =
    await searchParams;

  if (appointmentId) {
    redirect(encounterWorkspacePath(appointmentId));
  }

  const ctx = await requireRouteAccess("clinical_chart", "read");
  const canWriteClinical = Boolean(
    ctx.staffMember?.role &&
      hasPermission(ctx.staffMember.role, PERMISSIONS.clinical_chart.write),
  );

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
  const encounterQueue = await getEncounterQueueAppointments(
    ctx.tenant.id,
    ctx.tenant.timezone,
  ).catch(() => []);
  const resumeSessions = activeSessions.map((session) => ({
    id: session.id,
    patientId: session.patientId,
    appointmentId: session.appointmentId,
    startedAt: session.startedAt.toISOString(),
    patientName:
      `${session.patient.firstName ?? ""} ${session.patient.lastName ?? ""}`.trim() ||
      "Patient",
  }));

  const openEncounter = patientId
    ? await findOpenUnbilledEncounterForPatient(ctx.tenant.id, patientId)
    : null;

  const spineReturnAppointmentId =
    (fromSpine === "1" && returnAppointmentId) || openEncounter?.appointmentId || undefined;

  const spineReturnPatient = spineReturnAppointmentId
    ? patients.find((p) => p.id === patientId)
    : undefined;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {spineReturnAppointmentId ? (
        <BackToSpineEncounterBanner
          appointmentId={spineReturnAppointmentId}
          patientLabel={
            spineReturnPatient
              ? `${spineReturnPatient.firstName} ${spineReturnPatient.lastName}`
              : undefined
          }
        />
      ) : null}
      {resumeSessions.length > 0 && <ResumeChairsideBanner sessions={resumeSessions} />}
      <EncounterQueuePanel appointments={encounterQueue} timezone={ctx.tenant.timezone} />
      <ClinicalBrowseLinks />
      <ClinicalPageClient
        canWriteClinical={canWriteClinical}
        patients={patients}
        selectedPatientId={patientId}
        appointmentId={appointmentId}
        procedures={serializedProcedures}
        initialChartData={chartData}
        providerName={providerName}
        clinicName={ctx.tenant.name}
        templates={templates}
        countryCode={ctx.tenant.countryCode}
        blockVisitInvoice={Boolean(openEncounter)}
        spineReturnAppointmentId={spineReturnAppointmentId}
      />
    </div>
  );
}
