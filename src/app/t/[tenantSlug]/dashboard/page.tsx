export const runtime = "nodejs";

import { requireTenantContextBySlug } from "@/lib/tenant/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContextBySlug(tenantSlug);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Welcome to {ctx.tenant.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Plan</p>
          <p className="text-xl font-semibold">{ctx.tenant.subscriptionPlan}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Subscription</p>
          <Badge>{ctx.tenant.subscriptionStatus}</Badge>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Tenant status</p>
          <Badge variant="outline">{ctx.tenant.status}</Badge>
        </Card>
      </div>
    </div>
  );
}
