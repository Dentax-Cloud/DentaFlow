import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeEntity } from "@/lib/utils/serialize";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";
import { Button } from "@/components/ui/button";
import { PurchaseOrdersClient } from "./purchase-orders-client";

export const runtime = "nodejs";

export default async function PurchaseOrdersPage() {
  const ctx = await requireRouteAccess("inventory", "read");
  const role = requireStaffMemberRole(ctx);
  const canWrite = hasPermission(role, PERMISSIONS.inventory.write);

  const [orders, catalog, suppliers] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { tenantId: ctx.tenant.id },
      include: { items: { include: { item: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.inventoryItem.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      select: { id: true, name: true, sku: true, cost: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    db.supplier.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedOrders = orders.map((po) =>
    serializeEntity(po, { items: "array" }),
  ) as unknown as Array<{
    id: string;
    poRef: string | null;
    status: string;
    total: number | string;
    items: Array<{
      id: string;
      inventoryItemId: string;
      orderedQty: number;
      receivedQty: number;
      unitCost: number | string;
      item?: { name: string } | null;
    }>;
  }>;

  const serializedCatalog = catalog.map((c) => ({
    id: c.id,
    name: c.name,
    sku: c.sku,
    cost: c.cost != null ? Number(c.cost) : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase orders</h1>
          <p className="text-muted-foreground">
            Create POs and receive stock (most-recent unit cost updates item cost)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>

      <PurchaseOrdersClient
        orders={serializedOrders}
        catalog={serializedCatalog}
        suppliers={suppliers}
        canWrite={canWrite}
      />
    </div>
  );
}
