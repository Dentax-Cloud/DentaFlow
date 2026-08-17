"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPurchaseOrder,
  receiveStock,
} from "@/app/(dashboard)/features/inventory/inventory-actions";
import { GoodsReceiptScanner } from "@/components/inventory/goods-receipt-scanner";

type PoLine = {
  id: string;
  inventoryItemId: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number | string;
  item?: { name: string } | null;
};

type PoRow = {
  id: string;
  poRef: string | null;
  status: string;
  total: number | string;
  items: PoLine[];
};

type CatalogItem = { id: string; name: string; sku: string; cost: number | string | null };
type SupplierOpt = { id: string; name: string };

export function PurchaseOrdersClient({
  orders: initialOrders,
  catalog,
  suppliers,
  canWrite = false,
}: {
  orders: PoRow[];
  catalog: CatalogItem[];
  suppliers: SupplierOpt[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lineItemId, setLineItemId] = useState(catalog[0]?.id ?? "");
  const [lineQty, setLineQty] = useState("10");
  const [lineCost, setLineCost] = useState(
    catalog[0]?.cost != null ? String(catalog[0].cost) : "1",
  );
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [receiveCost, setReceiveCost] = useState<Record<string, string>>({});

  const selectedPo = useMemo(
    () => orders.find((o) => o.id === selectedPoId) ?? null,
    [orders, selectedPoId],
  );

  async function handleCreate() {
    if (!lineItemId) {
      toast.error("Pick an inventory item");
      return;
    }
    const qty = Number(lineQty);
    const cost = Number(lineCost);
    if (!qty || qty < 1 || Number.isNaN(cost) || cost < 0) {
      toast.error("Enter valid quantity and unit cost");
      return;
    }
    setBusy(true);
    try {
      const po = await createPurchaseOrder({
        supplierId: supplierId || undefined,
        notes: "Created from purchase-orders UI",
        items: [{ inventoryItemId: lineItemId, orderedQty: qty, unitCost: cost }],
      });
      const itemName = catalog.find((c) => c.id === lineItemId)?.name ?? lineItemId;
      const created: PoRow = {
        id: po.id,
        poRef: po.poRef ?? null,
        status: String(po.status),
        total: Number(po.total),
        items: (po.items ?? []).map((l) => ({
          id: l.id,
          inventoryItemId: l.inventoryItemId,
          orderedQty: l.orderedQty,
          receivedQty: l.receivedQty,
          unitCost: Number(l.unitCost),
          item: { name: itemName },
        })),
      };
      setOrders((prev) => [created, ...prev]);
      toast.success(`Created ${po.poRef}`);
      setCreateOpen(false);
      setSelectedPoId(po.id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReceiveLine(line: PoLine) {
    if (!selectedPo) return;
    const qty = Number(receiveQty[line.id] ?? "0");
    const costRaw = receiveCost[line.id];
    const unitCost = costRaw != null && costRaw !== "" ? Number(costRaw) : Number(line.unitCost);
    if (!qty || qty < 1) {
      toast.error("Enter receive quantity");
      return;
    }
    setBusy(true);
    try {
      const result = await receiveStock({
        inventoryItemId: line.inventoryItemId,
        quantity: qty,
        unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
        purchaseOrderId: selectedPo.id,
        purchaseOrderItemId: line.id,
        notes: `PO line receive ${selectedPo.poRef ?? selectedPo.id}`,
      });
      toast.success(`Received ${qty} · ${result.transactionRef}`);
      setOrders((prev) =>
        prev.map((po) => {
          if (po.id !== selectedPo.id) return po;
          const items = po.items.map((l) =>
            l.id === line.id ? { ...l, receivedQty: l.receivedQty + qty } : l,
          );
          return {
            ...po,
            status: result.poStatus ?? po.status,
            items,
          };
        }),
      );
      setReceiveQty((prev) => ({ ...prev, [line.id]: "" }));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {canWrite ? (
          <Button size="sm" onClick={() => setCreateOpen((o) => !o)}>
            {createOpen ? "Hide create form" : "New purchase order"}
          </Button>
        ) : null}
        {selectedPo && (
          <Button size="sm" variant="outline" onClick={() => setSelectedPoId(null)}>
            Clear PO selection
          </Button>
        )}
      </div>

      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create purchase order</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Supplier (optional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Item</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={lineItemId}
                onChange={(e) => {
                  setLineItemId(e.target.value);
                  const item = catalog.find((c) => c.id === e.target.value);
                  if (item?.cost != null) setLineCost(String(item.cost));
                }}
              >
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Ordered qty</Label>
              <Input type="number" min={1} value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Unit cost</Label>
              <Input type="number" min={0} step="0.01" value={lineCost} onChange={(e) => setLineCost(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => void handleCreate()} disabled={busy}>
                Create PO
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Select a PO to receive lines against it. Scanner below inherits the selected PO id.
        </p>
        {orders.map((po) => (
          <Card
            key={po.id}
            className={selectedPoId === po.id ? "border-primary ring-1 ring-primary" : undefined}
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-mono text-base">{po.poRef ?? po.id}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge>{po.status}</Badge>
                  {canWrite ? (
                    <Button
                      size="sm"
                      variant={selectedPoId === po.id ? "default" : "outline"}
                      onClick={() => setSelectedPoId(po.id === selectedPoId ? null : po.id)}
                    >
                      {selectedPoId === po.id ? "Selected" : "Receive against"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {po.items.length} line(s) · Total {String(po.total)}
              </p>
              {selectedPoId === po.id && (
                <div className="space-y-3 border-t pt-3">
                  {po.items.map((line) => {
                    const remaining = Math.max(0, line.orderedQty - line.receivedQty);
                    return (
                      <div key={line.id} className="rounded border p-3">
                        <div className="font-medium">{line.item?.name ?? line.inventoryItemId}</div>
                        <div className="text-muted-foreground">
                          Ordered {line.orderedQty} · Received {line.receivedQty} · Remaining{" "}
                          {remaining}
                        </div>
                        {remaining > 0 && (
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            <div>
                              <Label className="text-xs">Qty</Label>
                              <Input
                                type="number"
                                min={1}
                                max={remaining}
                                className="w-24"
                                value={receiveQty[line.id] ?? ""}
                                onChange={(e) =>
                                  setReceiveQty((prev) => ({ ...prev, [line.id]: e.target.value }))
                                }
                                placeholder={String(remaining)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit cost</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-28"
                                value={receiveCost[line.id] ?? String(line.unitCost)}
                                onChange={(e) =>
                                  setReceiveCost((prev) => ({ ...prev, [line.id]: e.target.value }))
                                }
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleReceiveLine(line)}
                            >
                              Receive line
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <p className="text-sm text-muted-foreground">No purchase orders yet</p>
        )}
      </div>

      <GoodsReceiptScanner purchaseOrderId={selectedPoId ?? undefined} />
    </div>
  );
}
