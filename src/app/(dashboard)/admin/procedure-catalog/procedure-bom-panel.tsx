"use client";

import { useEffect, useState, useTransition } from "react";
import { Package, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getProcedureBomAction,
  listInventoryItemsForBom,
  removeProcedureBomItem,
  upsertProcedureBomItem,
} from "@/app/(dashboard)/admin/procedure-bom-actions";
import type { ProcedureBomLine } from "@/lib/inventory/procedure-bom";

type Props = {
  procedureId: string;
  procedureCode: string;
  procedureName: string;
  onClose: () => void;
};

export function ProcedureBomPanel({
  procedureId,
  procedureCode,
  procedureName,
  onClose,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<ProcedureBomLine[]>([]);
  const [items, setItems] = useState<
    Array<{ id: string; name: string; sku: string; unit: string; quantity: number }>
  >([]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [optional, setOptional] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      try {
        const [bom, inv] = await Promise.all([
          getProcedureBomAction(procedureId),
          listInventoryItemsForBom(),
        ]);
        setLines(bom);
        setItems(inv);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load BOM");
      }
    });
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
        });
        setLines(next);
        setItemId("");
        setQty("1");
        setOptional(false);
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

        {lines.length === 0 ? (
          <p className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-muted-foreground">
            No bill of materials configured for this procedure.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.itemName}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.defaultQuantity} {line.unit}
                    {line.isOptional ? " · optional" : " · required"} · stock{" "}
                    {line.stockOnHand}
                  </p>
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
            disabled={pending}
          >
            <option value="">Select inventory item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.sku}) · {i.quantity} on hand
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0.01}
              step="0.01"
              className="rounded-md border bg-white px-2 py-2 text-sm"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={pending}
              placeholder="Qty"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={optional}
                onChange={(e) => setOptional(e.target.checked)}
                disabled={pending}
              />
              Optional
            </label>
          </div>
          <Button type="button" size="sm" disabled={pending} onClick={handleAdd}>
            <Plus className="mr-1 h-4 w-4" />
            Add to BOM
          </Button>
        </div>
      </div>
    </div>
  );
}
