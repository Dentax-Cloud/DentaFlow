"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@prisma/client";
import { AlertTriangle, Package } from "lucide-react";

export function InventoryClient({
  items,
  lowStockCount,
}: {
  items: InventoryItem[];
  lowStockCount: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">{items.length} items tracked</p>
        </div>
        {lowStockCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {lowStockCount} low stock
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const isLow = item.quantity <= item.reorderLevel;
          return (
            <Card key={item.id} className={isLow ? "border-destructive" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  {item.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-2xl font-bold">{item.quantity}</span>
                  <span className="text-xs text-muted-foreground">
                    Reorder at {item.reorderLevel}
                  </span>
                </div>
                {item.expiryDate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expires: {new Date(item.expiryDate).toLocaleDateString()}
                  </p>
                )}
                {isLow && <Badge variant="destructive" className="mt-2">Low stock</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
