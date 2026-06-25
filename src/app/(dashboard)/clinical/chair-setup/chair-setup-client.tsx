"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/lib/ids/use-barcode-scanner";
import { scanSupplierBarcode, issueStockToProcedure } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TrayItem = { inventoryItemId: string; name: string; quantity: number };

export function ChairSetupClient({
  chairs,
}: {
  chairs: { id: string; name: string; branch: string }[];
}) {
  const [chairId, setChairId] = useState(chairs[0]?.id ?? "");
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [busy, setBusy] = useState(false);

  const handleScan = useCallback(async (code: string) => {
    try {
      const result = await scanSupplierBarcode(code);
      if (!result.found || !result.item) {
        toast.error("Item not found");
        return;
      }
      const item = result.item as { id: string; name: string };
      setTray((prev) => {
        const existing = prev.find((t) => t.inventoryItemId === item.id);
        if (existing) {
          return prev.map((t) =>
            t.inventoryItemId === item.id ? { ...t, quantity: t.quantity + 1 } : t,
          );
        }
        return [...prev, { inventoryItemId: item.id, name: item.name, quantity: 1 }];
      });
      toast.success(`Added ${item.name}`);
    } catch {
      toast.error("Scan failed");
    }
  }, []);

  useBarcodeScanner(handleScan, !!chairId);

  async function confirmSetup() {
    if (!chairId) return;
    setBusy(true);
    try {
      for (const line of tray) {
        await issueStockToProcedure({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          chairId,
          notes: "Chair setup",
        });
      }
      toast.success("Chair setup recorded");
      setTray([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tray scanner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={chairId} onValueChange={setChairId}>
          <SelectTrigger>
            <SelectValue placeholder="Select chair" />
          </SelectTrigger>
          <SelectContent>
            {chairs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.branch})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground">Scan items to add to tray</p>

        <ul className="space-y-2">
          {tray.map((item) => (
            <li key={item.inventoryItemId} className="flex justify-between rounded border p-2 text-sm">
              <span>{item.name}</span>
              <span>×{item.quantity}</span>
            </li>
          ))}
        </ul>

        <Button disabled={tray.length === 0 || busy} onClick={() => void confirmSetup()}>
          Confirm setup
        </Button>
      </CardContent>
    </Card>
  );
}
