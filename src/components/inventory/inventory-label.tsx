"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";

type Props = {
  itemRef: string;
  itemName: string;
  storageLocation?: string | null;
  minStock?: number | null;
  size: "SHELF" | "SMALL" | "BATCH";
  batchInfo?: {
    lotNumber?: string;
    expiryDate?: string;
    qty?: number;
  };
};

const LABEL_SIZES = {
  SHELF: { width: "62mm", height: "40mm", px: 234, fontSize: 11 },
  SMALL: { width: "38mm", height: "25mm", px: 144, fontSize: 9 },
  BATCH: { width: "62mm", height: "50mm", px: 234, fontSize: 11 },
} as const;

export function InventoryLabel({
  itemRef,
  itemName,
  storageLocation,
  minStock,
  size,
  batchInfo,
}: Props) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const labelId = `label-${itemRef.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const barcodeValue = itemRef.replace(/-/g, "");
  const dims = LABEL_SIZES[size];

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: "CODE128",
          width: size === "SHELF" ? 2 : 1.5,
          height: size === "SHELF" ? 40 : 25,
          displayValue: false,
          margin: 0,
        });
      } catch {
        // ignore invalid barcode data
      }
    }
  }, [barcodeValue, size]);

  function handlePrint() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = document.getElementById(labelId);
    if (!content) return;

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <style>
        @page { size: ${dims.width} ${dims.height}; margin: 2mm; }
        body { margin: 0; font-family: sans-serif; }
      </style>
      </head><body>${content.outerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div className="space-y-2">
      <div
        id={labelId}
        className="inline-block rounded border border-dashed bg-white p-2"
        style={{ width: dims.px, fontSize: dims.fontSize }}
      >
        <p className="truncate font-bold">{itemName}</p>
        <p className="font-mono text-xs">{itemRef}</p>
        {storageLocation && (
          <p className="text-xs text-muted-foreground">{storageLocation}</p>
        )}
        {minStock != null && (
          <p className="text-xs text-muted-foreground">Min: {minStock}</p>
        )}
        {batchInfo && (
          <div className="mt-1 border-t pt-1 text-xs">
            {batchInfo.lotNumber && <p>Lot: {batchInfo.lotNumber}</p>}
            {batchInfo.expiryDate && (
              <p>Exp: {new Date(batchInfo.expiryDate).toLocaleDateString("en-AE")}</p>
            )}
            {batchInfo.qty != null && <p>Qty: {batchInfo.qty}</p>}
          </div>
        )}
        <svg ref={barcodeRef} className="mt-1 w-full" />
      </div>

      <Button size="sm" variant="outline" onClick={handlePrint}>
        Print {size.toLowerCase()} label
      </Button>
    </div>
  );
}
