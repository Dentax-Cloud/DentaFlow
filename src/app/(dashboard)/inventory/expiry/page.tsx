import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getExpiryAlerts } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { ExpiryClient } from "./expiry-client";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";

export default async function InventoryExpiryPage() {
  await requireRouteAccess("inventory", "read");
  const alerts = (await getExpiryAlerts(90)).map((b) => ({
    id: b.id as string,
    batchRef: b.batchRef as string,
    lotNumber: (b.lotNumber as string | null) ?? null,
    expiryDate: b.expiryDate
      ? b.expiryDate instanceof Date
        ? b.expiryDate.toISOString()
        : String(b.expiryDate)
      : null,
    currentQty: b.currentQty as number,
    status: b.status as string,
    item: b.item as { name: string; unit: string },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expiry alerts</h1>
          <p className="text-muted-foreground">Monitor batch expiry and recalls</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
      <ExpiryClient initialAlerts={alerts} />
    </div>
  );
}
