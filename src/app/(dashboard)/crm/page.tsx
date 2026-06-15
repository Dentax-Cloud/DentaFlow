import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { CrmClient } from "./crm-client";

export default async function CrmPage() {
  const ctx = await requireRouteAccess("crm", "read");
  const [leads, campaigns, recalls] = await Promise.all([
    db.lead.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.campaign.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.recall.findMany({
      where: { tenantId: ctx.tenant.id, completedAt: null },
      include: { patient: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 30,
    }),
  ]);

  return <CrmClient leads={leads} campaigns={campaigns} recalls={recalls} />;
}
