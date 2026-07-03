export const runtime = "nodejs";

import { notFound } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { tenantWhere } from "@/lib/tenant/scoped";
import { serializeDecimal } from "@/lib/utils/serialize";
import { mapPlanItemForClient } from "@/lib/clinical/treatment-plan-types";
import { TreatmentPlanClient } from "./treatment-plan-client";
import { getTreatmentPlanEstimateData } from "@/app/(dashboard)/features/insurance/treatment-estimate-actions";

export default async function TreatmentPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRouteAccess("clinical", "read");

  const plan = await db.treatmentPlan.findFirst({
    where: tenantWhere(ctx.tenant.id, { id, deletedAt: null }),
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      items: { orderBy: [{ visitNumber: "asc" }, { priority: "asc" }] },
    },
  });

  if (!plan) notFound();

  const rootId = plan.parentPlanId ?? plan.id;
  const [procedures, versionsRaw] = await Promise.all([
    db.procedureCatalog.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    db.treatmentPlan.findMany({
      where: {
        tenantId: ctx.tenant.id,
        deletedAt: null,
        OR: [{ id: rootId }, { parentPlanId: rootId }],
      },
      select: { id: true, version: true, status: true, createdAt: true, title: true },
      orderBy: { version: "asc" },
    }),
  ]);

  const versions = versionsRaw.filter(
    (v, i, arr) => arr.findIndex((x) => x.id === v.id) === i,
  );

  const estimateData = await getTreatmentPlanEstimateData(plan.id);

  return (
    <TreatmentPlanClient
      plan={{
        id: plan.id,
        patientId: plan.patient.id,
        title: plan.title,
        status: plan.status,
        version: plan.version,
        description: plan.description,
        createdAt: plan.createdAt.toISOString(),
        patient: plan.patient,
        items: plan.items.map((item) => mapPlanItemForClient(item)),
      }}
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
      versions={versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
        title: v.title,
      }))}
      estimateData={estimateData}
    />
  );
}
