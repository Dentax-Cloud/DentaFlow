import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { canUseFeature } from "@/lib/features/plans";
import { FeatureUpgradePrompt } from "@/components/subscription/feature-upgrade-prompt";
import { db } from "@/lib/db";
import { homepageRecallQueueWhere } from "@/lib/recall/queue";
import { serializeEntity, serializeMany } from "@/lib/utils/serialize";
import { CrmClient } from "./crm-client";

export default async function CrmPage() {
  const ctx = await requireRouteAccess("crm", "read");

  if (!ctx.isSuperAdmin && !canUseFeature(ctx.tenant.subscriptionPlan, "crm")) {
    return (
      <FeatureUpgradePrompt
        title="CRM & marketing"
        description="Upgrade to Professional or Enterprise to access campaigns, recalls, and patient outreach."
      />
    );
  }

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
      where: homepageRecallQueueWhere(ctx.tenant.id),
      include: { patient: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 30,
    }),
  ]);

  return (
    <CrmClient
      leads={serializeMany(leads)}
      campaigns={serializeMany(campaigns)}
      recalls={recalls.map((recall) => serializeEntity(recall, { patient: "object" }))}
      tenantId={ctx.tenant.id}
    />
  );
}
