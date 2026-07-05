export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import NewPlanClient from "./new-plan-client";

export default async function NewTreatmentPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const { patientId } = await searchParams;
  const ctx = await requireRouteAccess("clinical_schedule", "read");

  const [patients, procedures] = await Promise.all([
    db.patient.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
      take: 200,
    }),
    db.procedureCatalog.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <NewPlanClient
      patients={patients}
      procedures={procedures.map((p) => {
        const s = serializeDecimal(p);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          price: Number(s.price ?? 0),
          duration: p.duration,
        };
      })}
      defaultPatientId={patientId ?? null}
    />
  );
}
