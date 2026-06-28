"use client";

import type { TrayItemCategory, TrayTemplateItem } from "@/lib/chair-setup/types";
import { CATEGORY_CONFIG } from "@/lib/chair-setup/constants";
import { groupByCategory } from "@/lib/chair-setup/helpers";
import { Button } from "@/components/ui/button";

type TemplateRow = {
  id: string;
  name: string;
  isDefault: boolean;
  notes: string | null;
  items: TrayTemplateItem[];
};

type Props = {
  templates: TemplateRow[];
  currency: string;
  canEdit: boolean;
  onEdit: (template: TemplateRow) => void;
  onDelete: (id: string) => void;
};

export function TemplateCards({
  templates,
  currency,
  canEdit,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {templates.map((template) => {
        const byCategory = groupByCategory(template.items);
        const estimatedCost = template.items
          .filter((i) => (i.category ?? "CONSUMABLE") !== "EQUIPMENT")
          .reduce((sum, i) => sum + (i.costPrice ?? 0) * i.qty, 0);

        return (
          <div
            key={template.id}
            className="overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between bg-gray-50 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.isDefault && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      ✓ Default
                    </span>
                  )}
                </div>
                {template.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{template.notes}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
                    ✏ Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-600"
                    onClick={() => onDelete(template.id)}
                  >
                    🗑
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-b px-5 py-3">
              {(Object.entries(byCategory) as [TrayItemCategory, TrayTemplateItem[]][])
                .filter(([, items]) => items.length > 0)
                .map(([cat, catItems]) => (
                  <div
                    key={cat}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${CATEGORY_CONFIG[cat].pill}`}
                  >
                    {CATEGORY_CONFIG[cat].icon}
                    {catItems.length} {CATEGORY_CONFIG[cat].label.toLowerCase()}
                  </div>
                ))}
            </div>

            <div className="px-5 py-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {template.items.slice(0, 6).map((item, i) => (
                  <div
                    key={`${item.inventoryItemId}-${i}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span>{CATEGORY_CONFIG[item.category ?? "CONSUMABLE"]?.icon ?? "•"}</span>
                    <span className="truncate">{item.itemName}</span>
                    <span className="flex-shrink-0 font-medium">
                      ×{item.qty} {item.unit}
                    </span>
                  </div>
                ))}
                {template.items.length > 6 && (
                  <div className="col-span-2 text-xs text-blue-600">
                    +{template.items.length - 6} more items
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t bg-gray-50 px-5 py-3 text-xs text-muted-foreground">
              <span>
                💰 Est. {currency} {estimatedCost.toFixed(2)} per setup
              </span>
              <span>{template.items.length} items total</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
