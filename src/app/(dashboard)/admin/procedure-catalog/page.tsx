import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { listProcedures } from "@/app/(dashboard)/features/admin/actions";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { ProcedureCatalogClient } from "./procedure-catalog-client";

export default async function ProcedureCatalogPage() {
  const ctx = await requireRouteAccess("admin", "read");
  const [procedures, inventoryItems] = await Promise.all([
    listProcedures(ctx.tenant.id),
    db.inventoryItem.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, quantity: true, cost: true },
    }),
  ]);

  const serializedProcedures = procedures.map(serializeDecimal);
  const serializedInventory = inventoryItems.map((i) => {
    const { cost, ...rest } = serializeDecimal(i);
    return { ...rest, costPerUnit: typeof cost === "number" ? cost : 0 };
  });

  return (
    <ProcedureCatalogClient
      initialProcedures={serializedProcedures}
      inventoryItems={serializedInventory}
    />
  );
}
