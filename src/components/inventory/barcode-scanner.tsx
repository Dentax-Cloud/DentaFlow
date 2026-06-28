"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { useBarcodeScanner } from "@/lib/ids/use-barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera } from "lucide-react";

type Props = {
  onScan: (code: string, format: string) => void;
  enabled?: boolean;
  mode?: "camera" | "usb" | "both";
  placeholder?: string;
};

export function BarcodeScanner({
  onScan,
  enabled = true,
  mode = "both",
  placeholder,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");

  const handleUsbScan = useCallback(
    (code: string) => {
      if (enabled && (mode === "usb" || mode === "both")) {
        onScan(code, "USB_SCANNER");
      }
    },
    [enabled, mode, onScan],
  );

  useBarcodeScanner(handleUsbScan, enabled && (mode === "usb" || mode === "both"));

  async function startCamera() {
    if (!videoRef.current) return;
    setCameraError(null);

    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            onScan(result.getText(), result.getBarcodeFormat().toString());
          }
        },
      );
      controlsRef.current = controls;
      setCameraActive(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Camera not available");
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  function submitManual() {
    if (manualInput.trim()) {
      onScan(manualInput.trim(), "MANUAL");
      setManualInput("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitManual();
          }}
          placeholder={placeholder ?? "Scan or type barcode..."}
          className="flex-1 font-mono text-sm"
          autoFocus
        />
        <Button onClick={submitManual} disabled={!manualInput.trim()}>
          Search
        </Button>
      </div>

      {(mode === "camera" || mode === "both") && (
        <div>
          {!cameraActive ? (
            <Button type="button" variant="link" className="h-auto p-0" onClick={startCamera}>
              <Camera className="mr-1 h-4 w-4" />
              Use camera to scan
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="relative aspect-video max-w-xs overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-48 rounded border-2 border-blue-400 opacity-70" />
                </div>
              </div>
              <Button type="button" variant="link" className="h-auto p-0 text-destructive" onClick={stopCamera}>
                Stop camera
              </Button>
            </div>
          )}

          {cameraError && <p className="mt-1 text-xs text-destructive">{cameraError}</p>}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        USB scanner: scan to auto-capture
        {(mode === "camera" || mode === "both") && " · Or use camera for mobile scanning"}
      </p>
    </div>
  );
}
