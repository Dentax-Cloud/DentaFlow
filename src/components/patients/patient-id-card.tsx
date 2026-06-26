"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { buildQrPayload, toBarcodeValue } from "@/lib/ids/barcode-utils";
import { Button } from "@/components/ui/button";

export type PatientIdCardProps = {
  patientId: string;
  patientName: string;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  criticalAllergy?: string | null;
  photoUrl?: string | null;
  clinicName: string;
  tenantCode: string;
  tenantSlug?: string;
  branchCode?: string | null;
  clinicPhone?: string | null;
};

export function PatientIdCard(props: PatientIdCardProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (barcodeRef.current && props.patientId) {
      try {
        JsBarcode(barcodeRef.current, toBarcodeValue(props.patientId), {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: false,
          margin: 0,
        });
      } catch {
        // invalid barcode value
      }
    }
    if (qrRef.current && props.patientId) {
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL ?? "";
      const portalUrl = props.tenantSlug
        ? `${baseUrl}/portal/${props.tenantSlug}`
        : undefined;
      void QRCode.toCanvas(
        qrRef.current,
        buildQrPayload({
          patientId: props.patientId,
          patientName: props.patientName,
          tenantCode: props.tenantCode,
          branchCode: props.branchCode ?? "",
          bloodGroup: props.bloodGroup,
          criticalAllergy: props.criticalAllergy,
          portalUrl,
        }),
        { width: 80, margin: 1 },
      );
    }
  }, [props]);

  function handlePrint() {
    const win = window.open("", "_blank", "width=400,height=280");
    if (!win) return;
    const barcodeSvg = barcodeRef.current?.outerHTML ?? "";
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Patient ID</title>
      <style>
        @page { size: 85.6mm 54mm; margin: 4mm; }
        body { font-family: system-ui, sans-serif; font-size: 10px; margin: 0; }
        .card { border: 1px solid #ccc; border-radius: 8px; overflow: hidden; }
        .header { background: #0ea5e9; color: white; padding: 6px 10px; display: flex; justify-content: space-between; }
        .body { display: flex; gap: 8px; padding: 8px; }
        .id { font-family: monospace; font-size: 11px; font-weight: bold; }
        .footer { background: #f1f5f9; padding: 4px 10px; font-size: 8px; }
      </style></head><body>
      <div class="card">
        <div class="header"><span>${props.clinicName}</span><span>${props.tenantCode}</span></div>
        <div class="body">
          <div>
            <div style="font-weight:bold;font-size:13px">${props.patientName}</div>
            ${props.dateOfBirth ? `<div>DOB: ${props.dateOfBirth.slice(0, 10)}</div>` : ""}
            <div class="id">${props.patientId}</div>
            ${props.bloodGroup ? `<div style="color:red">BG: ${props.bloodGroup}</div>` : ""}
          </div>
          <canvas id="qr"></canvas>
        </div>
        <div style="padding:0 8px">${barcodeSvg}</div>
        <div class="footer">${props.clinicPhone ?? ""} · ${props.branchCode ?? ""}</div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  return (
    <div className="w-[342px] rounded-xl border bg-white shadow-lg dark:bg-slate-900">
      <div className="flex items-center justify-between bg-primary px-3 py-2 text-primary-foreground">
        <span className="text-sm font-semibold">{props.clinicName}</span>
        <span className="font-mono text-xs">{props.tenantCode}</span>
      </div>
      <div className="flex gap-3 p-3">
        <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold">
          {props.patientName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{props.patientName}</div>
          {props.dateOfBirth && (
            <div className="text-xs text-muted-foreground">
              DOB: {props.dateOfBirth.slice(0, 10)}
            </div>
          )}
          <div className="font-mono text-sm font-semibold">{props.patientId}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {props.bloodGroup && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                {props.bloodGroup}
              </span>
            )}
            {props.criticalAllergy && (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                {props.criticalAllergy}
              </span>
            )}
          </div>
        </div>
        <canvas ref={qrRef} className="shrink-0" />
      </div>
      <div className="px-3 pb-2">
        <svg ref={barcodeRef} className="w-full" />
      </div>
      <div className="border-t bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        {props.clinicPhone} · {props.branchCode}
      </div>
      <div className="p-2">
        <Button size="sm" className="w-full" onClick={handlePrint}>
          Print ID card
        </Button>
      </div>
    </div>
  );
}
