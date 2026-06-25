"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { LABEL_SIZES, toBarcodeValue } from "@/lib/ids/barcode-utils";
import { Button } from "@/components/ui/button";

type LabelSize = keyof typeof LABEL_SIZES;

export type PatientLabelProps = {
  patientId: string;
  patientName: string;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  size?: LabelSize;
};

export function PatientLabel({
  patientId,
  patientName,
  dateOfBirth,
  bloodGroup,
  size = "standard",
}: PatientLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const dims = LABEL_SIZES[size];

  useEffect(() => {
    if (barcodeRef.current && patientId) {
      try {
        JsBarcode(barcodeRef.current, toBarcodeValue(patientId), {
          format: "CODE128",
          width: 1.2,
          height: 30,
          fontSize: 10,
          margin: 2,
        });
      } catch {
        // ignore
      }
    }
  }, [patientId]);

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    const w = dims.width;
    const h = dims.height;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Label</title>
      <style>@page { size: ${w}px ${h}px; margin: 2mm; } body { font-family: monospace; font-size: 10px; }</style>
      </head><body>
      <div style="font-weight:bold">${patientName}</div>
      <div>${patientId}</div>
      ${dateOfBirth ? `<div>DOB: ${dateOfBirth.slice(0, 10)}</div>` : ""}
      ${bloodGroup ? `<div>BG: ${bloodGroup}</div>` : ""}
      ${barcodeRef.current?.outerHTML ?? ""}
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <div
      className="rounded border bg-white p-2 dark:bg-slate-900"
      style={{ width: dims.width, minHeight: dims.height }}
    >
      <div className="truncate text-sm font-bold">{patientName}</div>
      <div className="font-mono text-xs">{patientId}</div>
      {dateOfBirth && <div className="text-xs text-muted-foreground">DOB: {dateOfBirth.slice(0, 10)}</div>}
      {bloodGroup && <div className="text-xs text-red-600">BG: {bloodGroup}</div>}
      <svg ref={barcodeRef} className="mt-1 w-full" />
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={handlePrint}>
        Print label
      </Button>
    </div>
  );
}
