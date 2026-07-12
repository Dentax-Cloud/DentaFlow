import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serializeDecimal } from "@/lib/utils/serialize";
import type { ChairsideTreatmentPlan } from "@/components/clinical/treatment-plan-inline-panel";
import type { OutstandingPlanItem } from "@/components/clinical/procedure-lines-panel";

const ACTIVE_PLAN_STATUSES = new Set(["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS"]);

export async function loadPatientTreatmentPlansForChart(
  patientId: string,
): Promise<ChairsideTreatmentPlan[]> {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  const plans = await db.treatmentPlan.findMany({
    where: { patientId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      items: {
        select: {
          id: true,
          description: true,
          status: true,
          totalCost: true,
          unitCost: true,
          visitNumber: true,
          phase: true,
          priority: true,
          linkedAppointmentId: true,
          procedureCode: true,
          procedureCatalogId: true,
        },
        orderBy: { visitNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    status: plan.status,
    items: (plan.items ?? []).map((item) => {
      const serialized = serializeDecimal(item);
      return {
        id: item.id,
        description: item.description,
        status: item.status,
        visitNumber: item.visitNumber,
        linkedAppointmentId: item.linkedAppointmentId,
        procedureCode: item.procedureCode,
        procedureCatalogId: item.procedureCatalogId,
        estimatedCost: Number(serialized.unitCost ?? serialized.totalCost ?? 0),
      };
    }),
  }));
}

export function buildOutstandingPlanItems(
  treatmentPlans: ChairsideTreatmentPlan[],
  appointmentId: string | null,
): OutstandingPlanItem[] {
  return treatmentPlans
    .filter((plan) => ACTIVE_PLAN_STATUSES.has(plan.status))
    .flatMap((plan) =>
      (plan.items ?? [])
        .filter(
          (item) =>
            item.status !== "completed" &&
            item.status !== "COMPLETED" &&
            (item.linkedAppointmentId === appointmentId || item.linkedAppointmentId == null),
        )
        .map((item) => ({
          id: item.id,
          description: item.description,
          planTitle: plan.title,
          procedureCode: item.procedureCode,
          unitCost: item.estimatedCost,
          linkedAppointmentId: item.linkedAppointmentId,
        })),
    );
}
