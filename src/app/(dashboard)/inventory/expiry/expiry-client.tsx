"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { disposeExpiredBatch } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type Alert = {
  id: string;
  batchRef: string;
  lotNumber: string | null;
  expiryDate: string | null;
  currentQty: number;
  status: string;
  item: { name: string; unit: string };
};

type Tab = "expired" | "7" | "30" | "90";

export function ExpiryClient({ initialAlerts }: { initialAlerts: Alert[] }) {
  const [tab, setTab] = useState<Tab>("30");
  const [alerts, setAlerts] = useState(initialAlerts);
  const [busy, setBusy] = useState<string | null>(null);

  const now = new Date();
  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (!a.expiryDate) return tab === "90";
      const exp = new Date(a.expiryDate);
      const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (tab === "expired") return days < 0;
      if (tab === "7") return days >= 0 && days <= 7;
      if (tab === "30") return days >= 0 && days <= 30;
      return days >= 0 && days <= 90;
    });
  }, [alerts, tab, now]);

  async function handleDispose(id: string) {
    setBusy(id);
    try {
      await disposeExpiredBatch(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Batch disposed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispose failed");
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "expired", label: "Expired" },
    { id: "7", label: "7 days" },
    { id: "30", label: "30 days" },
    { id: "90", label: "90 days" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No batches in this window</p>
      ) : (
        filtered.map((batch) => (
          <Card key={batch.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{batch.item.name}</div>
                <div className="text-sm text-muted-foreground">
                  Lot: {batch.lotNumber ?? "—"} · Qty: {batch.currentQty} {batch.item.unit}
                </div>
                <div className="font-mono text-xs">{batch.batchRef}</div>
              </div>
              <div className="text-right">
                {batch.expiryDate && (
                  <div className="text-sm">{formatDate(batch.expiryDate)}</div>
                )}
                <Badge variant="outline" className="mt-1">
                  {batch.status}
                </Badge>
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-2 block w-full"
                  disabled={busy === batch.id}
                  onClick={() => void handleDispose(batch.id)}
                >
                  Dispose
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
