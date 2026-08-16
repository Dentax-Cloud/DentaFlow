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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryItem, StockTransaction } from "@prisma/client";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  History,
  LayoutGrid,
  List,
  Minus,
  ScanLine,
  Search,
  Send,
  Plus,
} from "lucide-react";
import { addStock, issueStock, removeStock } from "@/app/(dashboard)/features/inventory/actions";
import { scanSupplierBarcode } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { BarcodeScanner } from "@/components/inventory/barcode-scanner";
import { InventoryItemThumb } from "@/components/inventory/inventory-item-thumb";
import { cn } from "@/lib/utils";
import {
  distinctCategories,
  filterInventoryListItems,
  inventoryStatusLabel,
  isExpiringSoon,
  isLowStock,
  reorderAt,
  sortInventoryListItems,
  type InventoryListSortDir,
  type InventoryListSortKey,
  type InventoryListStockFilter,
  type InventoryListViewMode,
} from "@/lib/inventory/inventory-list-filters";
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
  defaultTier?: string | null;
  gtin?: string | null;
  supplier?: { id: string; name: string } | null;
  batches?: Array<{ id: string; expiryDate?: Date | string | null }>;
};

type ChairOpt = { id: string; name: string; number: number };
type StaffOpt = { id: string; label: string };

export function InventoryClient({
  items: initialItems,
  lowStockCount,
  chairs = [],
  staff = [],
  canWrite = false,
}: {
  items: ItemWithHistory[];
  lowStockCount: number;
  chairs?: ChairOpt[];
  staff?: StaffOpt[];
  canWrite?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [stockFilter, setStockFilter] = useState<InventoryListStockFilter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<InventoryListViewMode>("card");
  const [sortKey, setSortKey] = useState<InventoryListSortKey>("name");
  const [sortDir, setSortDir] = useState<InventoryListSortDir>("asc");
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
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
  const [scanFound, setScanFound] = useState<ItemWithHistory | null>(null);
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState("");

  const categories = useMemo(() => distinctCategories(items), [items]);

  const filtered = useMemo(() => {
    const base = filterInventoryListItems(items, {
      stockFilter,
      category,
      search,
      focusItemId,
    });
    return sortInventoryListItems(base, sortKey, sortDir) as ItemWithHistory[];
  }, [items, stockFilter, category, search, focusItemId, sortKey, sortDir]);

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

  function toggleSort(key: InventoryListSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function SortIcon({ column }: { column: InventoryListSortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  function clearScanFocus() {
    setFocusItemId(null);
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

  async function handleScanToSearch(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setScanNotFound(null);
    setScanFound(null);
    setScanCode(trimmed);
    try {
      const result = await scanSupplierBarcode(trimmed);
      if (!result.found || !result.item) {
        setScanNotFound(trimmed);
        toast.error("No inventory item matches this barcode");
        return;
      }
      const item = result.item as ItemWithHistory;
      const fromList = items.find((i) => i.id === item.id) ?? item;
      setScanFound(fromList);
      toast.success(`Found: ${fromList.name}`);
    } catch {
      setScanNotFound(trimmed);
      toast.error("Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  function applyScanFocus() {
    if (!scanFound) return;
    setFocusItemId(scanFound.id);
    setSearch("");
    setCategory(null);
    setStockFilter("all");
    setDialog(null);
    setScanFound(null);
    setScanNotFound(null);
    toast.success(`Showing ${scanFound.name}`);
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
          <p className="text-muted-foreground">
            {filtered.length} of {items.length} items
            {focusItemId ? " · scan match" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setScanFound(null);
              setScanNotFound(null);
              setScanCode("");
              setDialog("scan");
            }}
          >
            <ScanLine className="mr-1 h-4 w-4" />
            Scan item
          </Button>
          <Button
            variant={stockFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStockFilter("all")}
          >
            All
          </Button>
          <Button
            variant={stockFilter === "low" ? "destructive" : "outline"}
            size="sm"
            onClick={() => setStockFilter("low")}
          >
            Low stock ({lowStockCount})
          </Button>
          <div className="flex rounded-md border">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "card" ? "default" : "ghost"}
              className="rounded-r-none"
              onClick={() => setViewMode("card")}
              aria-pressed={viewMode === "card"}
            >
              <LayoutGrid className="mr-1 h-4 w-4" />
              Card
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              className="rounded-l-none"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
            >
              <List className="mr-1 h-4 w-4" />
              Table
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (focusItemId) setFocusItemId(null);
            }}
            placeholder="Search name, SKU, or category…"
            className="pl-8"
            aria-label="Search inventory"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Category</span>
            <Button
              size="sm"
              variant={category === null ? "secondary" : "outline"}
              onClick={() => {
                setCategory(null);
                if (focusItemId) setFocusItemId(null);
              }}
            >
              All categories
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={category === cat ? "secondary" : "outline"}
                onClick={() => {
                  setCategory(cat);
                  if (focusItemId) setFocusItemId(null);
                }}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
        {focusItemId && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">Scan filter active</Badge>
            <Button size="sm" variant="ghost" onClick={clearScanFocus}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No items match the current filters.
        </p>
      )}

      {viewMode === "card" && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const reorder = reorderAt(item);
            const isLow = isLowStock(item);
            const maxStock = Math.max(item.reorderLevel * 3, item.quantity, 1);
            const pct = Math.min(100, Math.round((item.quantity / maxStock) * 100));
            return (
              <Card
                key={item.id}
                className={cn(isLow && "border-destructive", focusItemId === item.id && "ring-2 ring-primary")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <InventoryItemThumb
                      imageUrl={item.imageUrl}
                      name={item.name}
                      size="sm"
                    />
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
                    <span className="text-xs text-muted-foreground">Reorder at {reorder}</span>
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
                    {canWrite ? (
                      <>
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
                      </>
                    ) : null}
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
      )}

      {viewMode === "table" && filtered.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" aria-label="Photo" />
                {(
                  [
                    ["name", "Name"],
                    ["sku", "SKU"],
                    ["category", "Category"],
                    ["quantity", "On hand"],
                    ["reorderLevel", "Reorder"],
                    ["supplier", "Supplier"],
                    ["tier", "Tier"],
                    ["status", "Status"],
                  ] as const
                ).map(([key, label]) => (
                  <TableHead key={key}>
                    <button
                      type="button"
                      className="inline-flex items-center font-medium hover:text-foreground"
                      onClick={() => toggleSort(key)}
                    >
                      {label}
                      <SortIcon column={key} />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const status = inventoryStatusLabel(item);
                const low = isLowStock(item);
                const expiring = isExpiringSoon(item);
                return (
                  <TableRow
                    key={item.id}
                    className={cn(focusItemId === item.id && "bg-primary/5")}
                    data-item-id={item.id}
                  >
                    <TableCell className="w-12 pr-0">
                      <InventoryItemThumb
                        imageUrl={item.imageUrl}
                        name={item.name}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/inventory/${item.id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell>{item.category ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="tabular-nums">{reorderAt(item)}</TableCell>
                    <TableCell>{item.supplier?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{item.defaultTier ?? "consumable"}</TableCell>
                    <TableCell>
                      {low || expiring ? (
                        <Badge variant={low ? "destructive" : "secondary"}>{status}</Badge>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
            setScanFound(null);
            setScanNotFound(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan to find item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Scan a GTIN or linked supplier barcode to jump to that item in the list.
          </p>
          <BarcodeScanner
            onScan={(code) => void handleScanToSearch(code)}
            mode="both"
            placeholder="Scan GTIN or supplier barcode…"
          />

          {scanNotFound && (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
              role="status"
              data-testid="scan-not-found"
            >
              <p className="font-medium text-destructive">Item not found</p>
              <p className="mt-1 text-muted-foreground">
                No inventory item matches barcode{" "}
                <span className="font-mono text-foreground">{scanNotFound}</span>.
              </p>
            </div>
          )}

          {scanFound && (
            <div className="space-y-3 rounded-lg border p-4" data-testid="scan-found">
              <div>
                <p className="font-medium">{scanFound.name}</p>
                <p className="text-sm text-muted-foreground">
                  SKU: <span className="font-mono">{scanFound.sku}</span>
                </p>
                {scanFound.gtin ? (
                  <p className="text-sm text-muted-foreground">
                    GTIN: <span className="font-mono">{scanFound.gtin}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">GTIN: not set</p>
                )}
                <p className="mt-1 text-2xl font-bold">{scanFound.quantity} in stock</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={applyScanFocus} disabled={busy}>
                  Show in list
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/inventory/${scanFound.id}`}>View details</Link>
                </Button>
              </div>
              {scanCode && (
                <p className="text-xs text-muted-foreground">
                  Matched code: <span className="font-mono">{scanCode}</span>
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
