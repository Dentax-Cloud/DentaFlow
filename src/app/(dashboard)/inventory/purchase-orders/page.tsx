import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeEntity } from "@/lib/utils/serialize";
import { GoodsReceiptScanner } from "@/components/inventory/goods-receipt-scanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";

export default async function PurchaseOrdersPage() {
  const ctx = await requireRouteAccess("inventory", "read");

  const orders = await db.purchaseOrder.findMany({
    where: { tenantId: ctx.tenant.id },
    include: { items: { include: { item: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase orders</h1>
          <p className="text-muted-foreground">Order and receive supplier stock</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>

      <GoodsReceiptScanner />

      <div className="space-y-3">
        {orders.map((po) => {
          const serialized = serializeEntity(po, { items: "array" });
          return (
            <Card key={po.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-base">{po.poRef ?? po.id}</CardTitle>
                  <Badge>{po.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {po.items.length} line(s) · Total {String(serialized.total)}
              </CardContent>
            </Card>
          );
        })}
        {orders.length === 0 && (
          <p className="text-sm text-muted-foreground">No purchase orders yet</p>
        )}
      </div>
    </div>
  );
}
