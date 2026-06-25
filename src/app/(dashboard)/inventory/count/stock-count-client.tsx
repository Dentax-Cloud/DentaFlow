"use client";

import { useState } from "react";
import { toast } from "sonner";
import { removeStock, addStock } from "@/app/(dashboard)/features/inventory/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  itemRef: string | null;
};

export function StockCountClient({ items: initial }: { items: Item[] }) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submitCount() {
    setSubmitting(true);
    try {
      let adjustments = 0;
      for (const item of initial) {
        const actualStr = counts[item.id];
        if (actualStr === undefined || actualStr === "") continue;
        const actual = parseInt(actualStr, 10);
        if (isNaN(actual)) continue;
        const variance = actual - item.quantity;
        if (variance === 0) continue;
        if (variance > 0) {
          await addStock({ inventoryItemId: item.id, quantity: variance, notes: "Stock count adjustment" });
        } else {
          await removeStock({ inventoryItemId: item.id, quantity: -variance, notes: "Stock count adjustment" });
        }
        adjustments++;
      }
      toast.success(`${adjustments} adjustment(s) recorded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Count submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["SKU", "Name", "Expected", "Actual", "Variance"],
      ...initial.map((item) => {
        const actual = counts[item.id] !== undefined && counts[item.id] !== "" ? counts[item.id] : "";
        const variance =
          actual !== "" ? String(parseInt(actual, 10) - item.quantity) : "";
        return [item.sku, item.name, String(item.quantity), actual, variance];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock-count.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => void submitCount()} disabled={submitting}>
          Submit count
        </Button>
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {initial.map((item) => {
        const actualStr = counts[item.id];
        const actual = actualStr !== undefined && actualStr !== "" ? parseInt(actualStr, 10) : null;
        const variance = actual !== null && !isNaN(actual) ? actual - item.quantity : null;

        return (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.itemRef ?? item.sku} · Expected: {item.quantity}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  className="w-24"
                  placeholder="Actual"
                  value={counts[item.id] ?? ""}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
                {variance !== null && (
                  <span
                    className={cn(
                      "w-16 text-right font-medium",
                      variance === 0 ? "text-green-600" : variance > 0 ? "text-blue-600" : "text-red-600",
                    )}
                  >
                    {variance > 0 ? "+" : ""}
                    {variance}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
