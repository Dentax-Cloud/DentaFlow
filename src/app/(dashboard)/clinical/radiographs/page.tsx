export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { parseAnnotations } from "@/lib/clinical/image-types";
import RadiographPageClient from "./radiograph-client";

export default async function RadiographPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; upload?: string }>;
}) {
  const { patientId, upload } = await searchParams;
  const ctx = await requireRouteAccess("clinical", "read");

  const patients = await db.patient.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
    take: 200,
  });

  const images = patientId
    ? await db.clinicalImage.findMany({
        where: { tenantId: ctx.tenant.id, patientId },
        orderBy: { takenAt: "desc" },
      })
    : [];

  return (
    <RadiographPageClient
      patients={patients}
      selectedPatientId={patientId ?? null}
      openUpload={upload === "1" || upload === "true"}
      images={images.map((img) => ({
        id: img.id,
        url: img.url,
        type: img.type,
        fileName: img.fileName,
        toothNumbers: img.toothNumbers,
        quadrant: img.quadrant,
        notes: img.notes,
        takenAt: img.takenAt?.toISOString() ?? null,
        annotations: parseAnnotations(img.annotations),
      }))}
    />
  );
}
