"use client";

import { useEffect, useRef } from "react";

export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  delayMs = 30000,
) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      void saveFn(dataRef.current).catch(console.error);
    }, delayMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [saveFn, delayMs]);
}
