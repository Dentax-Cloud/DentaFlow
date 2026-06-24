"use client";

import { useState, useRef, useCallback } from "react";

type Props = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
};

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
}: Props) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    updatePosition(e.clientX);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return;
    updatePosition(e.clientX);
  }

  function handleMouseUp() {
    isDragging.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    updatePosition(e.touches[0].clientX);
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full cursor-col-resize select-none overflow-hidden rounded-xl bg-black"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
    >
      <img
        src={afterUrl}
        alt={afterLabel}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="absolute inset-0 h-full object-contain"
          style={{ width: `${100 / (position / 100)}%` }}
        />
      </div>

      <div
        className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-lg"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
          <span className="text-xs font-bold text-gray-700">⇔</span>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {beforeLabel}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {afterLabel}
      </div>
    </div>
  );
}
