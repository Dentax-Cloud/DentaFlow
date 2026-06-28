"use client";

import type { TrayItemCategory, TrayTemplateItem } from "@/lib/chair-setup/types";
import { TRAY_CATEGORIES } from "@/lib/chair-setup/constants";
import { inferTrayCategory } from "@/lib/chair-setup/helpers";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InventoryRow = {
  id: string;
  name: string;
  unit: string;
  cost: number | null;
  category: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: {
    name: string;
    isDefault: boolean;
    notes: string;
    items: TrayTemplateItem[];
  };
  inventoryItems: InventoryRow[];
  onFormChange: (form: Props["form"]) => void;
  onSave: () => void;
  isPending: boolean;
};

export function TemplateFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  inventoryItems,
  onFormChange,
  onSave,
  isPending,
}: Props) {
  function addItem(inventoryItemId: string) {
    const inv = inventoryItems.find((i) => i.id === inventoryItemId);
    if (!inv || form.items.some((i) => i.inventoryItemId === inventoryItemId)) return;
    onFormChange({
      ...form,
      items: [
        ...form.items,
        {
          inventoryItemId: inv.id,
          itemName: inv.name,
          qty: 1,
          unit: inv.unit,
          category: inferTrayCategory(inv.category),
          costPrice: inv.cost ?? undefined,
        },
      ],
    });
  }

  function updateItem(index: number, patch: Partial<TrayTemplateItem>) {
    onFormChange({
      ...form,
      items: form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  function removeItem(index: number) {
    onFormChange({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => onFormChange({ ...form, isDefault: e.target.checked })}
            />
            Default template
          </label>

          <div>
            <Label>Add item from inventory</Label>
            <Select onValueChange={addItem}>
              <SelectTrigger>
                <SelectValue placeholder="Search inventory item..." />
              </SelectTrigger>
              <SelectContent>
                {inventoryItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {form.items.map((item, index) => (
              <div
                key={`${item.inventoryItemId}-${index}`}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border p-3"
              >
                <div className="col-span-2">
                  <select
                    value={item.category}
                    onChange={(e) =>
                      updateItem(index, { category: e.target.value as TrayItemCategory })
                    }
                    className="w-full rounded border px-2 py-1.5 text-xs"
                  >
                    {TRAY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === "CONSUMABLE" && "🧤 Consumable"}
                        {cat === "MEDICATION" && "💊 Medication"}
                        {cat === "MATERIAL" && "🧪 Material"}
                        {cat === "EQUIPMENT" && "🔧 Equipment"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-5">
                  <Input value={item.itemName} readOnly className="text-sm" />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    className="text-center text-sm"
                    onChange={(e) =>
                      updateItem(index, { qty: parseInt(e.target.value, 10) || 1 })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    value={item.unit}
                    className="text-sm"
                    onChange={(e) => updateItem(index, { unit: e.target.value })}
                  />
                </div>
                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600"
                    onClick={() => removeItem(index)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onSave}
            disabled={isPending || !form.name || form.items.length === 0}
          >
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
