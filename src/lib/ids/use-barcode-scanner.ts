"use client";

import { useEffect, useRef, useCallback } from "react";

export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef("");
  const lastKey = useRef(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (Date.now() - lastKey.current > 100) {
          buffer.current = "";
          return;
        }
      }

      const now = Date.now();
      if (now - lastKey.current > 300) buffer.current = "";
      lastKey.current = now;

      if (e.key === "Enter" || e.key === "Tab") {
        const code = buffer.current.trim();
        if (code.length >= 6) onScan(code);
        buffer.current = "";
        return;
      }

      if (e.key.length === 1) buffer.current += e.key;
    },
    [enabled, onScan],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
