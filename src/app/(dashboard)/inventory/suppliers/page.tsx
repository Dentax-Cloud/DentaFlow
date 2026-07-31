import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { listSuppliers } from "@/app/(dashboard)/features/inventory/supplier-actions";
import { SuppliersClient } from "./suppliers-client";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";

export default async function SuppliersPage() {
  await requireRouteAccess("inventory", "read");
  const rows = await listSuppliers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">Create and manage inventory suppliers</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
      <SuppliersClient
        suppliers={rows.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          address: s.address,
          itemCount: s._count.items,
        }))}
      />
    </div>
  );
}
