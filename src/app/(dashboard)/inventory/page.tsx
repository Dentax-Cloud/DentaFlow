import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const ctx = await requireRouteAccess("inventory", "read");
  const items = await db.inventoryItem.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const lowStock = items.filter((i) => i.quantity <= i.reorderLevel);

  return <InventoryClient items={items} lowStockCount={lowStock.length} />;
}
