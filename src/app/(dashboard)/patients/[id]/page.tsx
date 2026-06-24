import { notFound } from "next/navigation";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { isUploadthingConfigured } from "@/lib/uploadthing-env";
import { getPatientById } from "@/app/(dashboard)/features/patients/actions";
import { PatientDetailClient } from "./PatientDetailClient";
import { mapPatientTo360Profile } from "./map-patient-360";

export const runtime = "nodejs";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRouteAccess("patients", "read");

  const [patient, latestPerio] = await Promise.all([
    getPatientById(ctx.tenant.id, id),
    db.perioChart.findFirst({
      where: { tenantId: ctx.tenant.id, patientId: id },
      orderBy: { chartDate: "desc" },
    }),
  ]);

  if (!patient) notFound();

  return (
    <PatientDetailClient
      patient={mapPatientTo360Profile(patient)}
      uploadsEnabled={isUploadthingConfigured()}
      latestPerio={
        latestPerio
          ? {
              id: latestPerio.id,
              chartDate: latestPerio.chartDate.toISOString(),
              perioStage: latestPerio.perioStage,
              perioGrade: latestPerio.perioGrade,
              bopPercent: latestPerio.bopPercent,
            }
          : null
      }
    />
  );
}

