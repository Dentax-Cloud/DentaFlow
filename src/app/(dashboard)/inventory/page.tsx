import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeEntity } from "@/lib/utils/serialize";
import { InventoryClient } from "./inventory-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function InventoryPage() {
  const ctx = await requireRouteAccess("inventory", "read");
  const items = await db.inventoryItem.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      batches: {
        where: { status: "ACTIVE" },
        select: { id: true, expiryDate: true },
      },
      supplier: { select: { id: true, name: true } },
    },
  });

  const lowStock = items.filter((i) => i.quantity <= (i.minStockAlert ?? i.reorderLevel));
  const serializedItems = items.map((item) =>
    serializeEntity(item, {
      transactions: "array",
      batches: "array",
      supplier: "object",
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory/purchase-orders">Purchase orders</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory/suppliers">Suppliers</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory/expiry">Expiry alerts</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory/count">Stock count</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory/pos">POS / Sales</Link>
        </Button>
      </div>
      <InventoryClient items={serializedItems} lowStockCount={lowStock.length} />
    </div>
  );
}
