import { AiChatClient } from "./ai-chat-client";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";

export default async function AiPage() {
  const ctx = await requireRouteAccess("ai", "use");
  return (
    <AiChatClient
      tenantName={ctx.tenant.name}
      plan={ctx.tenant.subscriptionPlan}
    />
  );
}
