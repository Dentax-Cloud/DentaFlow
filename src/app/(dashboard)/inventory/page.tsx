import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeEntity } from "@/lib/utils/serialize";
import { InventoryClient } from "./inventory-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { can, hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";

export default async function InventoryPage() {
  const ctx = await requireRouteAccess("inventory", "read");
  const role = requireStaffMemberRole(ctx);
  const canSeeChairs = can(role, "read", "chair_inventory");
  const canWrite = hasPermission(role, PERMISSIONS.inventory.write);

  const [items, chairs, staff] = await Promise.all([
    db.inventoryItem.findMany({
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
    }),
    db.chair.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      select: { id: true, name: true, number: true },
      orderBy: { number: "asc" },
    }),
    db.staffMember.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: "asc" },
      take: 100,
    }),
  ]);

  const lowStock = items.filter((i) => i.quantity <= (i.minStockAlert ?? i.reorderLevel));
  const serializedItems = items.map((item) =>
    serializeEntity(item, {
      transactions: "array",
      batches: "array",
      supplier: "object",
    }),
  );

  const staffOpts = staff.map((s) => ({
    id: s.id,
    label: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory/purchase-orders">Purchase orders</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory/suppliers">Suppliers</Link>
        </Button>
        {canSeeChairs && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/chairs">Chair stock</Link>
          </Button>
        )}
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
      <InventoryClient
        items={serializedItems}
        lowStockCount={lowStock.length}
        chairs={chairs}
        staff={staffOpts}
        canWrite={canWrite}
      />
    </div>
  );
}
