export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { generateAnalyticsSummary } from "@/lib/ai";
import { canUseFeature } from "@/lib/features/plans";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ctx;
  try {
    ctx = await requireTenantContext();
  } catch (err) {
    console.error("[analytics-summary] tenant context error:", err);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[analytics-summary] tenant plan:", ctx.tenant.subscriptionPlan, ctx.tenant);

  const plan =
    (ctx.tenant.subscriptionPlan as SubscriptionPlan | undefined) ?? "STARTER";

  if (!canUseFeature(plan, "aiEnabled")) {
    return Response.json({ error: "Upgrade required" }, { status: 403 });
  }

  let metrics: Record<string, number | string>;
  try {
    const body = await req.json();
    metrics = body.metrics ?? {};
  } catch (err) {
    console.error("[analytics-summary] invalid request body:", err);
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const summary = await generateAnalyticsSummary({
      appointments: metrics.todayAppointments ?? metrics.appointments ?? 0,
      revenue: metrics.revenueThisMonth ?? metrics.revenue ?? 0,
      patients: metrics.patientCount ?? metrics.patients ?? 0,
      pendingInvoices: metrics.pendingInvoices ?? 0,
      completedToday: metrics.completedToday ?? 0,
      chairUtilization: metrics.chairUtilization ?? 0,
    });
    return Response.json({ summary });
  } catch (err) {
    console.error("[analytics-summary] OpenAI error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 500 });
  }
}
