export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateCampaignTemplate } from "@/lib/ai";
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

    const { intent } = await req.json();
    const template = await generateCampaignTemplate(intent);
    return Response.json(template);
  } catch (err) {
    console.error("[campaign-template]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
