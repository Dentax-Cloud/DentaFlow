export const runtime = "nodejs";

import { streamText } from "ai";
import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant/context";
import { chatWithStaffOrPatient } from "@/lib/ai";
import { canUseFeature } from "@/lib/features/plans";

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = await getTenantContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  if (!canUseFeature(ctx.tenant.subscriptionPlan, "aiEnabled")) {
    return new Response("Feature not available", { status: 403 });
  }

  const { messages, role = "staff" } = await req.json();

  const result = chatWithStaffOrPatient(
    {
      role: role as "staff" | "patient",
      tenantName: ctx.tenant.name,
    },
    messages,
  );

  return result.toDataStreamResponse();
}
