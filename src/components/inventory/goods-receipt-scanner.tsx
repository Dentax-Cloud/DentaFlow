"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  scanSupplierBarcode,
  receiveStock,
} from "@/app/(dashboard)/features/inventory/inventory-actions";
import { BarcodeScanner } from "@/components/inventory/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PackageCheck } from "lucide-react";

type ReceiptLine = {
  inventoryItemId: string;
  name: string;
  quantity: number;
  unitCost: number;
  lotNumber?: string;
  expiryDate?: string;
};

export function GoodsReceiptScanner({ purchaseOrderId }: { purchaseOrderId?: string }) {
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [busy, setBusy] = useState(false);

  const handleScan = useCallback(async (code: string) => {
    setBusy(true);
    try {
      const result = await scanSupplierBarcode(code);
      if (!result.found || !result.item) {
        toast.error("Unknown barcode");
        return;
      }
      const item = result.item as { id: string; name: string };
      const qty = result.gs1Data?.quantity ?? result.packSize ?? 1;
      setLines((prev) => [
        ...prev,
        {
          inventoryItemId: item.id,
          name: item.name,
          quantity: qty,
          unitCost: 0,
          lotNumber: result.gs1Data?.lotNumber,
          expiryDate: result.gs1Data?.expiryDate,
        },
      ]);
      toast.success(`Scanned: ${item.name}`);
    } catch {
      toast.error("Scan failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const totalCost = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  async function receiveAll() {
    setBusy(true);
    try {
      for (const line of lines) {
        await receiveStock({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          unitCost: line.unitCost || undefined,
          purchaseOrderId,
          lotNumber: line.lotNumber,
          expiryDate: line.expiryDate,
        });
      }
      toast.success(`Received ${lines.length} line(s)`);
      setLines([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5" />
          Goods receipt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <BarcodeScanner
          onScan={(code) => void handleScan(code)}
          mode="both"
          placeholder="Scan supplier barcode (GS1 supported)..."
        />

        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={`${line.inventoryItemId}-${i}`} className="rounded border p-3 text-sm">
                <div className="font-medium">{line.name}</div>
                <div>Qty: {line.quantity}</div>
                {line.lotNumber && <div>Lot: {line.lotNumber}</div>}
                {line.expiryDate && <div>Expiry: {line.expiryDate.slice(0, 10)}</div>}
                <Input
                  type="number"
                  className="mt-2"
                  placeholder="Unit cost"
                  value={line.unitCost || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setLines((prev) =>
                      prev.map((l, idx) => (idx === i ? { ...l, unitCost: val } : l)),
                    );
                  }}
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="font-medium">Total cost: {formatCurrency(totalCost)}</span>
              <Button onClick={() => void receiveAll()} disabled={busy}>
                Receive all
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
