import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { canUseFeature } from "@/lib/features/plans";
import { FeatureUpgradePrompt } from "@/components/subscription/feature-upgrade-prompt";
import { db } from "@/lib/db";
import { overdueRecallWhere, upcomingRecallWhere } from "@/lib/recall/queue";
import { serializeEntity } from "@/lib/utils/serialize";
import { RecallsClient } from "./recalls-client";

export default async function RecallsPage() {
  const ctx = await requireRouteAccess("crm", "read");

  if (!ctx.isSuperAdmin && !canUseFeature(ctx.tenant.subscriptionPlan, "crm")) {
    return (
      <FeatureUpgradePrompt
        title="Recalls"
        description="Upgrade to Professional or Enterprise to manage patient recall campaigns."
      />
    );
  }

  const [overdue, upcoming] = await Promise.all([
    db.recall.findMany({
      where: overdueRecallWhere(ctx.tenant.id),
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    }),
    db.recall.findMany({
      where: upcomingRecallWhere(ctx.tenant.id),
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const serializeRecalls = (rows: typeof overdue) =>
    rows.map((recall) => serializeEntity(recall, { patient: "object" }));

  return (
    <RecallsClient overdue={serializeRecalls(overdue)} upcoming={serializeRecalls(upcoming)} />
  );
}
