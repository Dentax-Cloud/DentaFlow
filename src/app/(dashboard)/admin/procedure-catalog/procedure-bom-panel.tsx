"use client";

import { useEffect, useState, useTransition } from "react";
import { Package, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getProcedureBomAction,
  listInventoryItemsForBom,
  removeProcedureBomItem,
  setProcedureBomItemBillable,
  upsertProcedureBomItem,
} from "@/app/(dashboard)/admin/procedure-bom-actions";
import type { ProcedureBomLine } from "@/lib/inventory/procedure-bom";

type InventoryOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
};

/** Shared add/list/remove UI — used inside the procedure edit modal and the standalone panel. */
export function ProcedureBomEditor({
  procedureId,
  compact = false,
}: {
  procedureId: string;
  /** Tighter spacing when embedded under pricing/settings. */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<ProcedureBomLine[]>([]);
  const [items, setItems] = useState<InventoryOption[]>([]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [optional, setOptional] = useState(false);
  const [billable, setBillable] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    startTransition(async () => {
      try {
        const [bom, inv] = await Promise.all([
          getProcedureBomAction(procedureId),
          listInventoryItemsForBom(),
        ]);
        if (cancelled) return;
        setLines(bom);
        setItems(inv);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load BOM");
          setLoaded(true);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [procedureId]);

  function handleAdd() {
    if (!itemId) {
      toast.error("Select an inventory item");
      return;
    }
    const n = Number(qty);
    if (!(n > 0)) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    startTransition(async () => {
      try {
        const next = await upsertProcedureBomItem({
          procedureCatalogId: procedureId,
          inventoryItemId: itemId,
          defaultQuantity: n,
          isOptional: optional,
          isBillable: billable,
        });
        setLines(next);
        setItemId("");
        setQty("1");
        setOptional(false);
        setBillable(false);
        toast.success("BOM updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save BOM item");
      }
    });
  }

  function handleRemove(bomItemId: string) {
    startTransition(async () => {
      try {
        const next = await removeProcedureBomItem({
          procedureCatalogId: procedureId,
          bomItemId,
        });
        setLines(next);
        toast.success("BOM item removed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove BOM item");
      }
    });
  }

  function handleToggleBillable(bomItemId: string, nextBillable: boolean) {
    startTransition(async () => {
      try {
        const next = await setProcedureBomItemBillable({
          procedureCatalogId: procedureId,
          bomItemId,
          isBillable: nextBillable,
        });
        setLines(next);
        toast.success(nextBillable ? "Marked billable" : "Marked bundled");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update billable flag");
      }
    });
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!loaded ? (
        <p className="text-xs text-muted-foreground">Loading bill of materials…</p>
      ) : lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-muted-foreground">
          No bill of materials configured for this procedure.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{line.itemName}</p>
                <p className="text-xs text-muted-foreground">
                  {line.defaultQuantity} {line.unit}
                  {line.isOptional ? " · optional" : " · required"} · stock{" "}
                  {line.stockOnHand}
                  {line.isBillable ? " · billable" : " · bundled"}
                </p>
                <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={line.isBillable}
                    disabled={pending}
                    onChange={(e) => handleToggleBillable(line.id, e.target.checked)}
                  />
                  Billable (separate invoice line)
                </label>
              </div>
              <button
                type="button"
                className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                disabled={pending}
                onClick={() => handleRemove(line.id)}
                aria-label={`Remove ${line.itemName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-lg border bg-slate-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add consumable
        </p>
        <select
          className="w-full rounded-md border bg-white px-2 py-2 text-sm"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          disabled={pending || !loaded}
        >
          <option value="">Select inventory item…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.sku}) · {i.quantity} on hand
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            min={0.01}
            step="0.01"
            className="rounded-md border bg-white px-2 py-2 text-sm"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={pending || !loaded}
            placeholder="Qty"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={optional}
              onChange={(e) => setOptional(e.target.checked)}
              disabled={pending || !loaded}
            />
            Optional
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              disabled={pending || !loaded}
            />
            Billable
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending || !loaded}
          onClick={handleAdd}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add to BOM
        </Button>
      </div>
    </div>
  );
}

type PanelProps = {
  procedureId: string;
  procedureCode: string;
  procedureName: string;
  onClose: () => void;
};

/** Standalone modal (row “BoM” shortcut). Prefer the edit-pricing modal for discovery. */
export function ProcedureBomPanel({
  procedureId,
  procedureCode,
  procedureName,
  onClose,
}: PanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Package className="h-5 w-5 text-teal-700" />
              Bill of materials
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {procedureCode} · {procedureName}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ProcedureBomEditor procedureId={procedureId} />
      </div>
    </div>
  );
}
