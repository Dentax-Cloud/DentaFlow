import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { listProcedures } from "@/app/(dashboard)/features/admin/actions";
import { db } from "@/lib/db";
import { ProcedureCatalogClient } from "./procedure-catalog-client";

export default async function ProcedureCatalogPage() {
  const ctx = await requireRouteAccess("admin", "read");
  const [procedures, inventoryItems] = await Promise.all([
    listProcedures(ctx.tenant.id),
    db.inventoryItem.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, quantity: true },
    }),
  ]);

  return (
    <ProcedureCatalogClient initialProcedures={procedures} inventoryItems={inventoryItems} />
  );
}
