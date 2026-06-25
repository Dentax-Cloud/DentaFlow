"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { toBarcodeValue } from "@/lib/ids/barcode-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PrintableInvoiceProps = {
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  invoiceRef?: string | null;
  invoiceNumber: string;
  createdAt: string;
  dueDate?: string | null;
  patientName: string;
  patientId?: string | null;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  balanceDue?: number;
};

export function PrintableInvoice(props: PrintableInvoiceProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const code = props.invoiceRef ?? props.invoiceNumber;
    if (barcodeRef.current && code) {
      try {
        JsBarcode(barcodeRef.current, toBarcodeValue(code), {
          format: "CODE128",
          width: 1.5,
          height: 36,
          fontSize: 10,
        });
      } catch {
        // ignore
      }
    }
    if (qrRef.current) {
      void QRCode.toCanvas(qrRef.current, code, { width: 72, margin: 1 });
    }
  }, [props.invoiceRef, props.invoiceNumber]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-white p-6 text-sm print:border-0 print:shadow-none">
      <div className="flex justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-bold">{props.clinicName}</h2>
          {props.clinicAddress && <p className="text-muted-foreground">{props.clinicAddress}</p>}
          {props.clinicPhone && <p>{props.clinicPhone}</p>}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">TAX INVOICE</div>
          <div className="font-mono">{props.invoiceRef ?? props.invoiceNumber}</div>
          <div>{formatDate(props.createdAt)}</div>
        </div>
      </div>

      <div className="flex justify-between">
        <div>
          <div className="font-medium">{props.patientName}</div>
          {props.patientId && <div className="font-mono text-xs">{props.patientId}</div>}
        </div>
        <canvas ref={qrRef} />
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((item, i) => (
            <tr key={i} className="border-b border-dashed">
              <td className="py-2">{item.description}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
              <td className="py-2 text-right">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-48 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(props.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT (5%)</span>
          <span>{formatCurrency(props.tax)}</span>
        </div>
        {props.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCurrency(props.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatCurrency(props.total)}</span>
        </div>
        {props.balanceDue != null && props.balanceDue > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Balance due</span>
            <span>{formatCurrency(props.balanceDue)}</span>
          </div>
        )}
      </div>

      <svg ref={barcodeRef} className="w-full" />

      <p className="text-center text-xs text-muted-foreground">Thank you for choosing {props.clinicName}</p>

      <Button className="print:hidden" onClick={handlePrint}>
        Print invoice
      </Button>
    </div>
  );
}
