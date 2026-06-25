import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { PosTerminal } from "@/components/inventory/pos-terminal";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";

export default async function InventoryPosPage() {
  await requireRouteAccess("inventory", "read");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">POS / Sales</h1>
          <p className="text-muted-foreground">Retail pharmacy and product sales</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
      <PosTerminal />
    </div>
  );
}
