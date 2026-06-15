export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant/context";
import { generateAnalyticsSummary } from "@/lib/ai";
import { canUseFeature } from "@/lib/features/plans";

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getTenantContext();
  if (!ctx || !canUseFeature(ctx.tenant.subscriptionPlan, "aiEnabled")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { metrics } = await req.json();
  const summary = await generateAnalyticsSummary(metrics);
  return Response.json({ summary });
}
