export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateAnalyticsSummary } from "@/lib/ai";
import { canUseFeature } from "@/lib/features/plans";

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ctx = await requireTenantContext();
    const plan = ctx.tenant.subscriptionPlan;
    if (!canUseFeature(plan, "aiEnabled")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { metrics } = await req.json();
    const summary = await generateAnalyticsSummary(metrics);
    return Response.json({ summary });
  } catch (err) {
    console.error("[analytics-summary]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
