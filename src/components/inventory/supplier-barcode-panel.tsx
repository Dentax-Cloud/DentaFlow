"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "./barcode-scanner";
import { parseGS1 } from "@/lib/ids/gs1-parser";
import { linkSupplierBarcode } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type SupplierBarcode = {
  id: string;
  barcode: string;
  barcodeType: string;
  packSize: number;
  packUnit: string;
  isDefault: boolean;
};

type Props = {
  inventoryItemId: string;
  currentBarcodes: SupplierBarcode[];
  itemUnit: string;
};

const BARCODE_TYPE_COLORS: Record<string, string> = {
  EAN13: "bg-blue-100 text-blue-700",
  EAN8: "bg-blue-100 text-blue-700",
  UPCA: "bg-purple-100 text-purple-700",
  GS1_128: "bg-green-100 text-green-700",
  CODE128: "bg-gray-100 text-gray-700",
};

function mapFormatToType(format: string): string {
  if (format.includes("EAN_13")) return "EAN13";
  if (format.includes("EAN_8")) return "EAN8";
  if (format.includes("UPC")) return "UPCA";
  if (format.includes("GS1") || format.includes("CODE_128")) return "GS1_128";
  return "CODE128";
}

export function SupplierBarcodePanel({
  inventoryItemId,
  currentBarcodes,
  itemUnit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [scannedFormat, setScannedFormat] = useState("");
  const [gs1Data, setGs1Data] = useState<ReturnType<typeof parseGS1> | null>(null);
  const [packSize, setPackSize] = useState(1);
  const [packUnit, setPackUnit] = useState(itemUnit);

  function handleScan(code: string, format: string) {
    setScannedCode(code);
    setScannedFormat(format);
    setShowScanner(false);

    if (format.includes("GS1") || format.includes("CODE_128")) {
      try {
        const parsed = parseGS1(code);
        if (parsed.gtin || parsed.lotNumber) {
          setGs1Data(parsed);
        }
      } catch {
        setGs1Data(null);
      }
    }
  }

  function handleLink() {
    if (!scannedCode) return;
    startTransition(async () => {
      await linkSupplierBarcode({
        inventoryItemId,
        barcode: scannedCode,
        barcodeType: mapFormatToType(scannedFormat),
        packSize,
        packUnit,
        isDefault: currentBarcodes.length === 0,
      });
      setScannedCode("");
      setGs1Data(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {currentBarcodes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Linked supplier barcodes
          </p>
          {currentBarcodes.map((bc) => (
            <div
              key={bc.id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
            >
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={BARCODE_TYPE_COLORS[bc.barcodeType] ?? "bg-gray-100"}
                >
                  {bc.barcodeType}
                </Badge>
                <div>
                  <p className="font-mono text-sm font-medium">{bc.barcode}</p>
                  <p className="text-xs text-muted-foreground">
                    Pack: {bc.packSize} {bc.packUnit}
                    {bc.isDefault && " · Default"}
                  </p>
                </div>
              </div>
              {bc.isDefault && (
                <span className="text-xs font-medium text-green-600">Default</span>
              )}
            </div>
          ))}
        </div>
      )}

      {!showScanner && !scannedCode && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setShowScanner(true)}
        >
          + Add supplier barcode (scan or type)
        </Button>
      )}

      {showScanner && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Scan or enter supplier barcode</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowScanner(false)}>
              Cancel
            </Button>
          </div>
          <BarcodeScanner
            onScan={handleScan}
            mode="both"
            placeholder="Scan EAN-13, UPC, or GS1-128..."
          />
        </div>
      )}

      {scannedCode && (
        <div className="space-y-3 rounded-lg border-2 border-blue-400 bg-blue-50/50 p-4">
          <p className="text-sm font-semibold text-blue-800">Barcode scanned</p>

          <div className="rounded border bg-white p-2 font-mono text-sm">{scannedCode}</div>

          {gs1Data && (gs1Data.gtin || gs1Data.lotNumber) && (
            <div className="space-y-1 rounded border border-green-200 bg-green-50 p-3 text-xs">
              <p className="font-semibold text-green-800">GS1-128 data extracted</p>
              {gs1Data.gtin && <p>GTIN: {gs1Data.gtin}</p>}
              {gs1Data.lotNumber && <p>Lot: {gs1Data.lotNumber}</p>}
              {gs1Data.expiryDate && (
                <p>Expiry: {gs1Data.expiryDate.toLocaleDateString("en-AE")}</p>
              )}
              {gs1Data.quantity != null && <p>Quantity: {gs1Data.quantity}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Pack size</Label>
              <Input
                type="number"
                min={1}
                value={packSize}
                onChange={(e) => setPackSize(parseInt(e.target.value, 10) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Pack unit</Label>
              <Input
                value={packUnit}
                onChange={(e) => setPackUnit(e.target.value)}
                className="mt-1"
                placeholder="PCS, BOX, TUBE..."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setScannedCode("");
                setGs1Data(null);
                setShowScanner(true);
              }}
            >
              Re-scan
            </Button>
            <Button type="button" className="flex-1" onClick={handleLink} disabled={isPending}>
              {isPending ? "Saving..." : "Link barcode"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
