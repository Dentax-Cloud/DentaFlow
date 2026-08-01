"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InventoryItem, StockTransaction } from "@prisma/client";
import { AlertTriangle, History, Minus, Package, Plus, ScanLine, Send } from "lucide-react";
import { addStock, issueStock, removeStock } from "@/app/(dashboard)/features/inventory/actions";
import {
  scanSupplierBarcode,
  receiveStock,
  issueStockToProcedure,
} from "@/app/(dashboard)/features/inventory/inventory-actions";
import { BarcodeScanner } from "@/components/inventory/barcode-scanner";
import { cn } from "@/lib/utils";
import {
  STOCK_ISSUE_REASONS,
  type StockIssueDestinationType,
  type StockIssueReason,
} from "@/lib/inventory/stock-issue";

type ItemWithHistory = InventoryItem & {
  transactions?: StockTransaction[];
  itemRef?: string | null;
  storageLocation?: string | null;
  minStockAlert?: number | null;
};

type FilterTab = "all" | "low";

type ChairOpt = { id: string; name: string; number: number };
type StaffOpt = { id: string; label: string };

export function InventoryClient({
  items: initialItems,
  lowStockCount,
  chairs = [],
  staff = [],
}: {
  items: ItemWithHistory[];
  lowStockCount: number;
  chairs?: ChairOpt[];
  staff?: StaffOpt[];
}) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [dialog, setDialog] = useState<"add" | "remove" | "history" | "scan" | "issue" | null>(
    null,
  );
  const [selected, setSelected] = useState<ItemWithHistory | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [issueReason, setIssueReason] = useState<StockIssueReason>("allocated-to-chair");
  const [destType, setDestType] = useState<StockIssueDestinationType>("chair");
  const [destId, setDestId] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanResult, setScanResult] = useState<{
    id: string;
    name: string;
    quantity: number;
    itemRef?: string | null;
  } | null>(null);
  const [scanQty, setScanQty] = useState("1");

  const filtered = useMemo(() => {
    if (filter === "low") return items.filter((i) => i.quantity <= i.reorderLevel);
    return items;
  }, [items, filter]);

  const criticalCount = items.filter((i) => i.quantity <= Math.floor(i.reorderLevel / 2)).length;

  function openDialog(type: "add" | "remove" | "history" | "issue", item: ItemWithHistory) {
    setSelected(item);
    setDialog(type);
    setQuantity("1");
    setNotes("");
    setUnitCost("");
    setIssueReason("allocated-to-chair");
    setDestType("chair");
    setDestId(chairs[0]?.id ?? "");
    setDestLabel("");
  }

  async function handleIssueStock() {
    if (!selected) return;
    const qty = Number(quantity);
    if (!qty || qty < 1) {
      toast.error("Enter a valid quantity");
      return;
    }
    setBusy(true);
    const result = await issueStock({
      inventoryItemId: selected.id,
      quantity: qty,
      reason: issueReason,
      destinationType: destType,
      destinationId: destType === "other" ? undefined : destId || undefined,
      destinationLabel: destType === "other" ? destLabel : undefined,
      notes: notes || undefined,
    });
    setBusy(false);
    if (result.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, quantity: i.quantity - qty } : i)),
      );
      toast.success(`Issued to ${result.data.destinationLabel}`);
      setDialog(null);
    } else {
      toast.error(result.error);
    }
  }

  async function handleAddStock() {
    if (!selected) return;
    const qty = Number(quantity);
    if (!qty || qty < 1) {
      toast.error("Enter a valid quantity");
      return;
    }
    setBusy(true);
    const result = await addStock({
      inventoryItemId: selected.id,
      quantity: qty,
      unitCost: unitCost ? Number(unitCost) : undefined,
      notes: notes || undefined,
    });
    setBusy(false);
    if (result.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, quantity: i.quantity + qty } : i)),
      );
      toast.success("Stock added");
      setDialog(null);
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemoveStock() {
    if (!selected) return;
    const qty = Number(quantity);
    if (!qty || qty < 1) {
      toast.error("Enter a valid quantity");
      return;
    }
    setBusy(true);
    const result = await removeStock({
      inventoryItemId: selected.id,
      quantity: qty,
      notes: notes || undefined,
    });
    setBusy(false);
    if (result.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, quantity: i.quantity - qty } : i)),
      );
      toast.success("Stock removed");
      setDialog(null);
    } else {
      toast.error(result.error);
    }
  }

  async function handleBarcodeScan(code: string) {
    setBusy(true);
    try {
      const result = await scanSupplierBarcode(code);
      if (!result.found || !result.item) {
        toast.error("Item not found for this barcode");
        setScanResult(null);
        return;
      }
      const item = result.item as {
        id: string;
        name: string;
        quantity: number;
        itemRef?: string | null;
      };
      setScanResult(item);
      setScanQty(String(result.gs1Data?.quantity ?? result.packSize ?? 1));
      toast.success(`Found: ${item.name}`);
    } catch {
      toast.error("Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleScanReceive() {
    if (!scanResult) return;
    const qty = Number(scanQty);
    if (!qty || qty < 1) {
      toast.error("Enter a valid quantity");
      return;
    }
    setBusy(true);
    try {
      await receiveStock({
        inventoryItemId: scanResult.id,
        quantity: qty,
        scannedBarcode: scanResult.itemRef ?? undefined,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === scanResult.id ? { ...i, quantity: i.quantity + qty } : i,
        ),
      );
      setScanResult((prev) => (prev ? { ...prev, quantity: prev.quantity + qty } : null));
      toast.success("Stock received");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleScanIssue(notesLabel: string) {
    if (!scanResult) return;
    const qty = Number(scanQty);
    if (!qty || qty < 1) {
      toast.error("Enter a valid quantity");
      return;
    }
    setBusy(true);
    try {
      await issueStockToProcedure({
        inventoryItemId: scanResult.id,
        quantity: qty,
        notes: notesLabel,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === scanResult.id ? { ...i, quantity: i.quantity - qty } : i,
        ),
      );
      setScanResult((prev) => (prev ? { ...prev, quantity: prev.quantity - qty } : null));
      toast.success("Stock issued");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {criticalCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {criticalCount} item{criticalCount === 1 ? "" : "s"} critically low — reorder soon.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">{items.length} items tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setScanResult(null);
              setScanQty("1");
              setDialog("scan");
            }}
          >
            <ScanLine className="mr-1 h-4 w-4" />
            Scan item
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "low" ? "destructive" : "outline"}
            size="sm"
            onClick={() => setFilter("low")}
          >
            Low stock ({lowStockCount})
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const reorderAt = item.minStockAlert ?? item.reorderLevel;
          const isLow = item.quantity <= reorderAt;
          const maxStock = Math.max(item.reorderLevel * 3, item.quantity, 1);
          const pct = Math.min(100, Math.round((item.quantity / maxStock) * 100));
          return (
            <Card key={item.id} className={cn(isLow && "border-destructive")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  <Link href={`/inventory/${item.id}`} className="hover:underline">
                    {item.name}
                  </Link>
                  {isLow && (
                    <Badge variant="destructive" className="ml-auto">
                      Low
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {item.itemRef ? (
                    <span className="font-mono">{item.itemRef}</span>
                  ) : (
                    <>SKU: {item.sku}</>
                  )}
                  {item.storageLocation && (
                    <span className="ml-2">· {item.storageLocation}</span>
                  )}
                </p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{item.quantity}</span>
                  <span className="text-xs text-muted-foreground">
                    Reorder at {reorderAt}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isLow ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => openDialog("add", item)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add stock
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openDialog("issue", item)}>
                    <Send className="mr-1 h-3 w-3" />
                    Issue
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openDialog("remove", item)}>
                    <Minus className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openDialog("history", item)}>
                    <History className="mr-1 h-3 w-3" />
                    History
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/inventory/${item.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialog === "add"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add stock — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Unit cost (optional)</Label>
              <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddStock} disabled={busy}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "issue"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue stock — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Reason</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={issueReason}
                onChange={(e) => setIssueReason(e.target.value as StockIssueReason)}
              >
                {STOCK_ISSUE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Destination type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={destType}
                onChange={(e) => {
                  const next = e.target.value as StockIssueDestinationType;
                  setDestType(next);
                  if (next === "chair") setDestId(chairs[0]?.id ?? "");
                  else if (next === "staff") setDestId(staff[0]?.id ?? "");
                  else setDestId("");
                }}
              >
                <option value="chair">Chair</option>
                <option value="staff">Staff</option>
                <option value="other">Other (free text)</option>
              </select>
            </div>
            {destType === "chair" && (
              <div>
                <Label>Chair</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                >
                  {chairs.length === 0 && <option value="">No chairs</option>}
                  {chairs.map((c) => (
                    <option key={c.id} value={c.id}>
                      Chair {c.number} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {destType === "staff" && (
              <div>
                <Label>Staff</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                >
                  {staff.length === 0 && <option value="">No staff</option>}
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {destType === "other" && (
              <div>
                <Label>Destination</Label>
                <Input value={destLabel} onChange={(e) => setDestLabel(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void handleIssueStock()} disabled={busy}>
              Issue stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "remove"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove stock — {selected?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Quick ad-hoc remove (notes only). Prefer <strong>Issue</strong> for audited
            destination + reason.
          </p>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Reason / notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleRemoveStock} disabled={busy}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "history"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock history — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {(selected?.transactions ?? []).length === 0 && (
              <p className="text-muted-foreground">No transactions yet.</p>
            )}
            {(selected?.transactions ?? []).map((tx) => (
              <div key={tx.id} className="flex justify-between border-b pb-2">
                <span>
                  {tx.type} × {tx.quantity}
                  {tx.notes && ` — ${tx.notes}`}
                </span>
                <span className="text-muted-foreground">
                  {new Date(tx.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "scan"}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setScanResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan inventory item</DialogTitle>
          </DialogHeader>
          <BarcodeScanner
            onScan={(code) => void handleBarcodeScan(code)}
            mode="both"
            placeholder="Scan supplier or internal barcode..."
          />

          {scanResult && (
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">{scanResult.name}</p>
                {scanResult.itemRef && (
                  <p className="font-mono text-xs text-muted-foreground">{scanResult.itemRef}</p>
                )}
                <p className="text-2xl font-bold">{scanResult.quantity} in stock</p>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={scanQty}
                  onChange={(e) => setScanQty(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void handleScanReceive()} disabled={busy}>
                  Receive stock
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleScanIssue("Issued to procedure")}
                  disabled={busy}
                >
                  Issue to procedure
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleScanIssue("Issued to chair")}
                  disabled={busy}
                >
                  Issue to chair
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/inventory/${scanResult.id}`}>View details</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
