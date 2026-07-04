"use client";

import { useMemo, useState } from "react";
import type { SetupItem, TrayItemCategory, TrayTemplateItem } from "@/lib/chair-setup/types";
import { CATEGORY_CONFIG, TRAY_CATEGORIES } from "@/lib/chair-setup/constants";
import { groupByCategory, inferTrayCategory } from "@/lib/chair-setup/helpers";
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
  quantity: number;
  unit: string;
  cost: number | null;
  category: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  items: TrayTemplateItem[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chairName: string;
  templates: TemplateRow[];
  inventoryItems: InventoryRow[];
  currency: string;
  items: SetupItem[];
  onItemsChange: (items: SetupItem[]) => void;
  onConfirm: () => void;
  isPending: boolean;
};

export function TraySetupModal({
  open,
  onOpenChange,
  chairName,
  templates,
  inventoryItems,
  currency,
  items,
  onItemsChange,
  onConfirm,
  isPending,
}: Props) {
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState("");

  const inventoryMap = useMemo(
    () => new Map(inventoryItems.map((i) => [i.id, i])),
    [inventoryItems],
  );

  const byCategory = groupByCategory(items);

  const costByCategory = TRAY_CATEGORIES.map((cat) => {
    const catItems = byCategory[cat];
    const cost = catItems.reduce((sum, item) => {
      if (item.category === "EQUIPMENT") return sum;
      const inv = inventoryMap.get(item.inventoryItemId);
      return sum + (inv?.cost ?? 0) * item.qty;
    }, 0);
    return { cat, cost, count: catItems.length };
  }).filter((c) => c.count > 0);

  const totalCost = costByCategory.reduce((s, c) => s + c.cost, 0);

  function renderTemplatePreview(items: TrayTemplateItem[]) {
    const grouped = groupByCategory(
      items.map((item) => ({ ...item, category: item.category ?? "CONSUMABLE" })),
    );
    const previewLines: string[] = [];
    for (const cat of TRAY_CATEGORIES) {
      const catItems = grouped[cat];
      if (!catItems.length) continue;
      const names = catItems.map((i) => `${i.itemName}${i.qty > 1 ? ` ×${i.qty}` : ""}`);
      previewLines.push(`${CATEGORY_CONFIG[cat].icon} ${names.slice(0, 4).join(", ")}${names.length > 4 ? ` +${names.length - 4} more` : ""}`);
    }
    return previewLines;
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    onItemsChange(
      template.items.map((item) => ({
        ...item,
        category: item.category ?? "CONSUMABLE",
      })),
    );
    setStep(2);
  }

  function updateItemQty(inventoryItemId: string, qty: number) {
    onItemsChange(
      items.map((i) =>
        i.inventoryItemId === inventoryItemId ? { ...i, qty: Math.max(1, qty) } : i,
      ),
    );
  }

  function removeItem(inventoryItemId: string) {
    onItemsChange(items.filter((i) => i.inventoryItemId !== inventoryItemId));
  }

  function addInventoryItem(id: string) {
    const inv = inventoryMap.get(id);
    if (!inv) return;
    if (items.some((i) => i.inventoryItemId === id)) return;
    onItemsChange([
      ...items,
      {
        inventoryItemId: inv.id,
        itemName: inv.name,
        qty: 1,
        unit: inv.unit,
        category: inferTrayCategory(inv.category),
        costPrice: inv.cost ?? undefined,
      },
    ]);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setStep(1);
          setTemplateId("");
        }
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set up tray — {chairName}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Step 1: Select a template or start with a manual setup.
            </p>
            <div className="grid gap-2">
              {templates.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No saved templates yet. Use manual setup or ask an admin to configure
                  templates under the Templates tab.
                </p>
              )}
              {templates.map((t) => {
                const preview = renderTemplatePreview(t.items);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    className="rounded-lg border p-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{t.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.items.length} items
                      </span>
                    </div>
                    {preview.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {preview.slice(0, 3).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                        {preview.length > 3 && (
                          <li className="text-muted-foreground/80">
                            +{preview.length - 3} more categories
                          </li>
                        )}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
              Manual setup
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Step 2: Review items by category. Equipment is verified only — not deducted.
            </p>

            <div>
              <Label>Add inventory item</Label>
              <Select onValueChange={addInventoryItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Search inventory..." />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.quantity} {i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {TRAY_CATEGORIES.map((cat) => {
              const catItems = byCategory[cat];
              if (!catItems.length) return null;
              const config = CATEGORY_CONFIG[cat];
              return (
                <div key={cat} className={`rounded-lg border p-3 ${config.bg}`}>
                  <p className="mb-2 text-xs font-semibold uppercase">
                    {config.icon} {config.label}
                  </p>
                  <div className="space-y-2">
                    {catItems.map((item) => {
                      const stock = inventoryMap.get(item.inventoryItemId)?.quantity ?? 0;
                      const lowStock = item.category !== "EQUIPMENT" && stock < item.qty;
                      return (
                        <div
                          key={item.inventoryItemId}
                          className="flex items-center justify-between gap-2 rounded border bg-white p-2 text-sm"
                        >
                          <div>
                            <p className={lowStock ? "font-medium text-red-600" : "font-medium"}>
                              {lowStock && "⚠ "}
                              {item.itemName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Available: {stock} {item.unit}
                            </p>
                          </div>
                          {item.category === "EQUIPMENT" ? (
                            <span className="text-xs text-green-600">Present</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={stock}
                                className="h-8 w-16"
                                value={item.qty}
                                onChange={(e) =>
                                  updateItemQty(
                                    item.inventoryItemId,
                                    parseInt(e.target.value, 10) || 1,
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="text-red-400"
                                onClick={() => removeItem(item.inventoryItemId)}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <Button variant="outline" onClick={() => setStep(3)} disabled={items.length === 0}>
              Review & confirm →
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Step 3: Confirm setup and deduct from store.</p>
            <div className="space-y-2 rounded-lg border p-4">
              {costByCategory.map(({ cat, cost, count }) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span>
                    {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label} ({count})
                  </span>
                  <span>
                    {currency} {cost.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total setup cost</span>
                <span>
                  {currency} {totalCost.toFixed(2)}
                </span>
              </div>
            </div>
            {templateId && (
              <p className="text-xs text-muted-foreground">
                Template: {templates.find((t) => t.id === templateId)?.name}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step === 3 && (
            <Button onClick={onConfirm} disabled={isPending || items.length === 0}>
              Confirm &amp; Deduct from Store
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
