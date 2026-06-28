"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryLabel } from "@/components/inventory/inventory-label";
import { SupplierBarcodePanel } from "@/components/inventory/supplier-barcode-panel";
import { ArrowLeft, AlertTriangle, Package } from "lucide-react";
import { cn } from "@/lib/utils";

type SupplierBarcode = {
  id: string;
  barcode: string;
  barcodeType: string;
  packSize: number;
  packUnit: string;
  isDefault: boolean;
};

type BatchRow = {
  id: string;
  batchRef: string;
  lotNumber: string | null;
  expiryDate: string | null;
  currentQty: number;
  receivedQty: number;
  status: string;
  unitCost?: number | null;
};

type TransactionRow = {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  transactionRef: string | null;
  createdAt: string;
  batch: { lotNumber: string | null; expiryDate: string | null } | null;
};

type ItemData = {
  id: string;
  name: string;
  sku: string;
  itemRef: string | null;
  category: string | null;
  unit: string;
  quantity: number;
  reorderLevel: number;
  minStockAlert: number | null;
  maxStock: number | null;
  cost: number | null;
  retailPrice: number | null;
  storageLocation: string | null;
  storageConditions: string | null;
  trackByBatch: boolean;
  trackByExpiry: boolean;
  gtin: string | null;
  supplierBarcodes: SupplierBarcode[];
  batches: BatchRow[];
  transactions: TransactionRow[];
};

type ProcedureLink = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  quantityPerProcedure: number;
};

type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCKED";

function getStockStatus(item: ItemData): StockStatus {
  const min = item.minStockAlert ?? item.reorderLevel;
  if (item.quantity <= 0) return "OUT_OF_STOCK";
  if (item.quantity <= min) return "LOW_STOCK";
  if (item.maxStock != null && item.quantity > item.maxStock) return "OVERSTOCKED";
  return "IN_STOCK";
}

const STATUS_COLORS: Record<StockStatus, string> = {
  IN_STOCK: "bg-green-100 text-green-800",
  LOW_STOCK: "bg-amber-100 text-amber-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
  OVERSTOCKED: "bg-blue-100 text-blue-800",
};

export function InventoryItemClient({
  item,
  currency,
  tenantCode,
  totalValue,
  linkedProcedures,
}: {
  item: ItemData;
  currency: string;
  tenantCode: string;
  totalValue: number;
  linkedProcedures: ProcedureLink[];
}) {
  const [txFilter, setTxFilter] = useState<string>("ALL");
  const status = getStockStatus(item);
  const minStock = item.minStockAlert ?? item.reorderLevel;
  const displayRef = item.itemRef ?? item.sku;

  const filteredTransactions = useMemo(() => {
    if (txFilter === "ALL") return item.transactions;
    return item.transactions.filter((t) => t.type === txFilter);
  }, [item.transactions, txFilter]);

  const expiringBatches = item.batches.filter((b) => {
    if (!b.expiryDate) return false;
    const days = (new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/inventory">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to inventory
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Package className="h-6 w-6" />
            {item.name}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">{displayRef}</p>
          {item.category && (
            <p className="text-sm text-muted-foreground">{item.category}</p>
          )}
        </div>
        <Badge className={cn("text-sm", STATUS_COLORS[status])}>{status.replace("_", " ")}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="barcodes">Barcodes</TabsTrigger>
          <TabsTrigger value="batches">Batches ({item.batches.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="procedures">Procedures ({linkedProcedures.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{item.quantity}</p>
                <p className="text-sm text-muted-foreground">
                  Min: {minStock}
                  {item.maxStock != null && ` · Max: ${item.maxStock}`}
                  {" · "}
                  Unit: {item.unit}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatCurrency(totalValue, currency)}</p>
                <p className="text-sm text-muted-foreground">
                  {item.cost != null
                    ? `${formatCurrency(item.cost, currency)} per ${item.unit}`
                    : "No cost set"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Location</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">{item.storageLocation ?? "Not assigned"}</p>
                {item.storageConditions && (
                  <p className="text-sm text-muted-foreground">{item.storageConditions}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {expiringBatches.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {expiringBatches.length} batch(es) expiring within 30 days
            </div>
          )}

          {item.itemRef && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Print labels</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-6">
                <InventoryLabel
                  itemRef={item.itemRef}
                  itemName={item.name}
                  storageLocation={item.storageLocation}
                  minStock={minStock}
                  size="SHELF"
                />
                <InventoryLabel
                  itemRef={item.itemRef}
                  itemName={item.name}
                  size="SMALL"
                />
              </CardContent>
            </Card>
          )}

          {!item.itemRef && tenantCode && (
            <p className="text-sm text-muted-foreground">
              Internal item reference not assigned — labels available after ID migration.
            </p>
          )}
        </TabsContent>

        <TabsContent value="barcodes" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supplier barcodes</CardTitle>
            </CardHeader>
            <CardContent>
              <SupplierBarcodePanel
                inventoryItemId={item.id}
                currentBarcodes={item.supplierBarcodes}
                itemUnit={item.unit}
              />
              {item.itemRef && (
                <div className="mt-6 border-t pt-6">
                  <p className="mb-3 text-sm font-medium">Internal barcode</p>
                  <InventoryLabel
                    itemRef={item.itemRef}
                    itemName={item.name}
                    storageLocation={item.storageLocation}
                    minStock={minStock}
                    size="SHELF"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="pt-4">
          {item.batches.length === 0 ? (
            <p className="text-muted-foreground">No active batches.</p>
          ) : (
            <div className="space-y-2">
              {item.batches.map((batch) => {
                const isExpiring =
                  batch.expiryDate &&
                  (new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <=
                    30;
                return (
                  <Card key={batch.id} className={cn(isExpiring && "border-amber-400")}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                      <div>
                        <p className="font-mono text-sm font-medium">{batch.batchRef}</p>
                        {batch.lotNumber && (
                          <p className="text-sm text-muted-foreground">Lot: {batch.lotNumber}</p>
                        )}
                        {batch.expiryDate && (
                          <p className="text-sm text-muted-foreground">
                            Exp: {new Date(batch.expiryDate).toLocaleDateString("en-AE")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{batch.currentQty}</p>
                        <Badge variant="outline">{batch.status}</Badge>
                      </div>
                      {item.itemRef && (
                        <InventoryLabel
                          itemRef={item.itemRef}
                          itemName={item.name}
                          size="BATCH"
                          batchInfo={{
                            lotNumber: batch.lotNumber ?? undefined,
                            expiryDate: batch.expiryDate ?? undefined,
                            qty: batch.currentQty,
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {["ALL", "PURCHASE", "USAGE", "ADJUSTMENT", "EXPIRED"].map((type) => (
              <Button
                key={type}
                size="sm"
                variant={txFilter === type ? "default" : "outline"}
                onClick={() => setTxFilter(type)}
              >
                {type}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredTransactions.length === 0 && (
              <p className="text-muted-foreground">No transactions.</p>
            )}
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <span className="font-medium">{tx.type}</span>
                  <span className="ml-2">× {tx.quantity}</span>
                  {tx.transactionRef && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {tx.transactionRef}
                    </span>
                  )}
                  {tx.notes && <p className="text-muted-foreground">{tx.notes}</p>}
                  {tx.batch?.lotNumber && (
                    <p className="text-xs text-muted-foreground">Lot: {tx.batch.lotNumber}</p>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {new Date(tx.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="procedures" className="pt-4">
          {linkedProcedures.length === 0 ? (
            <p className="text-muted-foreground">
              No procedures consume this item. Link it in Admin → Procedure catalog.
            </p>
          ) : (
            <div className="space-y-2">
              {linkedProcedures.map((proc) => (
                <Card key={proc.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{proc.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {proc.code}
                        {proc.category && ` · ${proc.category}`}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {proc.quantityPerProcedure} {item.unit} / procedure
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
