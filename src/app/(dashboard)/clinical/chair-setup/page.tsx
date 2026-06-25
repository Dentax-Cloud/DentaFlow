import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { ChairSetupClient } from "./chair-setup-client";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";

export default async function ChairSetupPage() {
  const ctx = await requireRouteAccess("clinical", "write");

  const chairs = await db.chair.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    include: { branch: { select: { name: true } } },
    orderBy: { number: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chair setup</h1>
          <p className="text-muted-foreground">Scan tray items for chair preparation</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/clinical">Back to clinical</Link>
        </Button>
      </div>
      <ChairSetupClient chairs={chairs.map((c) => ({ id: c.id, name: c.name, branch: c.branch.name }))} />
    </div>
  );
}
