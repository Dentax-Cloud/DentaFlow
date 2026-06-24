export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeEntity, serializeDecimal } from "@/lib/utils/serialize";
import { getVisitNumber } from "@/lib/clinical/treatment-plan-types";
import { TreatmentPlansListClient } from "./treatment-plans-list-client";

export default async function TreatmentPlansPage() {
  const ctx = await requireRouteAccess("clinical", "read");

  const [plans, patients] = await Promise.all([
    db.treatmentPlan.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        items: {
          select: {
            id: true,
            status: true,
            totalCost: true,
            visitNumber: true,
            phase: true,
            priority: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.patient.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { lastName: "asc" },
      take: 200,
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return (
    <TreatmentPlansListClient
      plans={plans.map((plan) => {
        const serialized = serializeEntity(plan, { patient: "object", items: "array" });
        return {
          ...serialized,
          totalCost: Number(serializeDecimal(plan).totalCost ?? 0),
          totalEstimate: Number(plan.totalEstimate ?? plan.totalCost ?? 0),
          items: plan.items.map((item) => ({
            id: item.id,
            status: item.status,
            estimatedCost: Number(serializeDecimal(item).totalCost ?? 0),
            visitNumber: getVisitNumber(item),
            priority: item.priority ?? "ELECTIVE",
          })),
        };
      })}
      patients={patients}
    />
  );
}
