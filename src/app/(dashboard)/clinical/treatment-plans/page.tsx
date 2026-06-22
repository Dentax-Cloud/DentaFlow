import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { TreatmentPlansListClient } from "./treatment-plans-list-client";

export default async function TreatmentPlansPage() {
  const ctx = await requireRouteAccess("clinical", "read");

  const [plans, patients] = await Promise.all([
    db.treatmentPlan.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.patient.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { lastName: "asc" },
      take: 100,
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return <TreatmentPlansListClient plans={plans} patients={patients} />;
}
