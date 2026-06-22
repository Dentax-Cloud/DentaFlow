import { notFound } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { tenantWhere } from "@/lib/tenant/scoped";
import { TreatmentPlanDetailClient } from "./treatment-plan-detail-client";

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
      patient: true,
      items: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!plan) notFound();

  const procedures = await db.procedureCatalog.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    orderBy: { name: "asc" },
  });

  return <TreatmentPlanDetailClient plan={plan} procedures={procedures} />;
}
