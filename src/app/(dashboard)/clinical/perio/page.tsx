export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import type { PerioMeasurement } from "@/lib/clinical/types";
import { BackToSpineEncounterBanner } from "@/components/clinical/back-to-spine-encounter-banner";
import { findOpenUnbilledEncounterForPatient } from "@/lib/encounter/legacy-invoice-guard";
import { PerioPageClient } from "./perio-client";

export default async function PerioPage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    fromSpine?: string;
    returnAppointmentId?: string;
  }>;
}) {
  const { patientId, fromSpine, returnAppointmentId } = await searchParams;
  const ctx = await requireRouteAccess("clinical_chart", "read");
  const canWriteClinical = Boolean(
    ctx.staffMember?.role &&
      hasPermission(ctx.staffMember.role, PERMISSIONS.clinical_chart.write),
  );

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

  const openEncounter = patientId
    ? await findOpenUnbilledEncounterForPatient(ctx.tenant.id, patientId)
    : null;

  const spineReturnAppointmentId =
    (fromSpine === "1" && returnAppointmentId) ||
    openEncounter?.appointmentId ||
    undefined;

  const spineReturnPatient = spineReturnAppointmentId
    ? patients.find((p) => p.id === patientId)
    : undefined;

  return (
    <div className="space-y-4">
      {spineReturnAppointmentId ? (
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <BackToSpineEncounterBanner
            appointmentId={spineReturnAppointmentId}
            patientLabel={
              spineReturnPatient
                ? `${spineReturnPatient.firstName} ${spineReturnPatient.lastName}`
                : undefined
            }
          />
        </div>
      ) : null}
      <PerioPageClient
        canWriteClinical={canWriteClinical}
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
    </div>
  );
}
