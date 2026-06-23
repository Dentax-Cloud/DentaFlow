import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeEntity } from "@/lib/utils/serialize";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const ctx = await requireRouteAccess("inventory", "read");
  const items = await db.inventoryItem.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  const lowStock = items.filter((i) => i.quantity <= i.reorderLevel);
  const serializedItems = items.map((item) =>
    serializeEntity(item, { transactions: "array" }),
  );

  return <InventoryClient items={serializedItems} lowStockCount={lowStock.length} />;
}
