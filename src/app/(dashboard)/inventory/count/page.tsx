import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { StockCountClient } from "./stock-count-client";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";

export default async function StockCountPage() {
  const ctx = await requireRouteAccess("inventory", "write");

  const items = await db.inventoryItem.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, quantity: true, itemRef: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock count</h1>
          <p className="text-muted-foreground">Physical inventory count</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
      <StockCountClient items={items} />
    </div>
  );
}
