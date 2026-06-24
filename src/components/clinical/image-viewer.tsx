"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { saveAnnotations } from "@/app/(dashboard)/features/clinical/image-actions";
import type { Annotation } from "@/lib/clinical/image-types";
import { ANNOTATION_COLORS } from "@/lib/clinical/image-types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  imageId: string;
  url: string;
  initialAnnotations?: Annotation[];
  readOnly?: boolean;
  onClose?: () => void;
};

type Tool = "pan" | "arrow" | "text" | "rect" | "circle";

export function ImageViewer({
  imageId,
  url,
  initialAnnotations = [],
  readOnly,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [inverted, setInverted] = useState(false);
  const [tool, setTool] = useState<Tool>("pan");
  const [color, setColor] = useState("#ef4444");
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      inverted ? "invert(1)" : "",
    ]
      .filter(Boolean)
      .join(" ");

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    ctx.filter = "none";
    annotations.forEach((ann) => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 2;
      ctx.font = "14px sans-serif";

      const ax = ann.x * scale + offset.x;
      const ay = ann.y * scale + offset.y;

      switch (ann.type) {
        case "arrow": {
          if (ann.x2 === undefined || ann.y2 === undefined) break;
          const ax2 = ann.x2 * scale + offset.x;
          const ay2 = ann.y2 * scale + offset.y;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax2, ay2);
          ctx.stroke();
          const angle = Math.atan2(ay2 - ay, ax2 - ax);
          ctx.beginPath();
          ctx.moveTo(ax2, ay2);
          ctx.lineTo(
            ax2 - 12 * Math.cos(angle - Math.PI / 6),
            ay2 - 12 * Math.sin(angle - Math.PI / 6),
          );
          ctx.lineTo(
            ax2 - 12 * Math.cos(angle + Math.PI / 6),
            ay2 - 12 * Math.sin(angle + Math.PI / 6),
          );
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "rect": {
          if (ann.x2 === undefined || ann.y2 === undefined) break;
          const ax2 = ann.x2 * scale + offset.x;
          const ay2 = ann.y2 * scale + offset.y;
          ctx.strokeRect(ax, ay, ax2 - ax, ay2 - ay);
          break;
        }
        case "circle": {
          if (ann.x2 === undefined || ann.y2 === undefined) break;
          const ax2 = ann.x2 * scale + offset.x;
          const ay2 = ann.y2 * scale + offset.y;
          const radius = Math.sqrt((ax2 - ax) ** 2 + (ay2 - ay) ** 2);
          ctx.beginPath();
          ctx.arc(ax, ay, radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "text": {
          ctx.fillText(ann.text ?? "Note", ax, ay);
          break;
        }
      }
    });
  }, [scale, offset, brightness, contrast, inverted, annotations]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        const fitScale = Math.min(scaleX, scaleY) * 0.9;
        setScale(fitScale);
        setOffset({
          x: (canvas.width - img.width * fitScale) / 2,
          y: (canvas.height - img.height * fitScale) / 2,
        });
      }
      draw();
    };
    img.onerror = () => toast.error("Could not load image");
    img.src = url;
  }, [url, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (tool === "pan") {
      setIsDragging(true);
      setDragStart({ x: canvasX - offset.x, y: canvasY - offset.y });
    } else if (!readOnly) {
      setDrawStart(getCanvasPos(e));
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (isDragging && tool === "pan") {
      setOffset({ x: canvasX - dragStart.x, y: canvasY - dragStart.y });
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDragging) {
      setIsDragging(false);
      return;
    }

    if (!readOnly && drawStart && tool !== "pan") {
      const pos = getCanvasPos(e);

      if (tool === "text") {
        const text = prompt("Enter annotation text:");
        if (!text) {
          setDrawStart(null);
          return;
        }
        const newAnn: Annotation = {
          id: crypto.randomUUID(),
          type: "text",
          x: drawStart.x,
          y: drawStart.y,
          text,
          color,
          createdAt: new Date().toISOString(),
        };
        setAnnotations((prev) => [...prev, newAnn]);
      } else {
        const newAnn: Annotation = {
          id: crypto.randomUUID(),
          type: tool,
          x: drawStart.x,
          y: drawStart.y,
          x2: pos.x,
          y2: pos.y,
          color,
          createdAt: new Date().toISOString(),
        };
        setAnnotations((prev) => [...prev, newAnn]);
      }
      setDrawStart(null);
    }
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.1, Math.min(10, prev * delta)));
  }

  async function handleSaveAnnotations() {
    setIsSaving(true);
    try {
      await saveAnnotations(imageId, annotations);
      toast.success("Annotations saved");
    } catch {
      toast.error("Could not save annotations");
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const scaleX = canvas.width / img.width;
    const scaleY = canvas.height / img.height;
    const fitScale = Math.min(scaleX, scaleY) * 0.9;
    setScale(fitScale);
    setOffset({
      x: (canvas.width - img.width * fitScale) / 2,
      y: (canvas.height - img.height * fitScale) / 2,
    });
    setBrightness(100);
    setContrast(100);
    setInverted(false);
  }

  const TOOLS: { id: Tool; icon: string; label: string }[] = [
    { id: "pan", icon: "✋", label: "Pan" },
    { id: "arrow", icon: "↗", label: "Arrow" },
    { id: "rect", icon: "⬜", label: "Rect" },
    { id: "circle", icon: "⭕", label: "Circle" },
    { id: "text", icon: "T", label: "Text" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-black">
      <div className="flex flex-wrap items-center gap-2 bg-zinc-900 p-2">
        {onClose && (
          <button type="button" onClick={onClose} className="px-2 text-zinc-400 hover:text-white">
            ✕
          </button>
        )}
        <div className="h-6 w-px bg-zinc-700" />
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(10, s * 1.2))}
          className="px-2 text-sm text-zinc-300 hover:text-white"
        >
          +
        </button>
        <span className="text-xs text-zinc-400">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.1, s / 1.2))}
          className="px-2 text-sm text-zinc-300 hover:text-white"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-2 text-xs text-zinc-300 hover:text-white"
        >
          Fit
        </button>
        <div className="h-6 w-px bg-zinc-700" />
        <input
          type="range"
          min={0}
          max={200}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-20 accent-blue-500"
          title="Brightness"
        />
        <input
          type="range"
          min={0}
          max={300}
          value={contrast}
          onChange={(e) => setContrast(Number(e.target.value))}
          className="w-20 accent-blue-500"
          title="Contrast"
        />
        <button
          type="button"
          onClick={() => setInverted((v) => !v)}
          className={`rounded px-2 py-1 text-xs ${
            inverted ? "bg-white text-black" : "text-zinc-300 hover:text-white"
          }`}
        >
          INV
        </button>
        <div className="h-6 w-px bg-zinc-700" />
        {!readOnly &&
          TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`rounded px-2 py-1 text-sm transition-colors ${
                tool === t.id ? "bg-blue-600 text-white" : "text-zinc-300 hover:text-white"
              }`}
            >
              {t.icon}
            </button>
          ))}
        {!readOnly && tool !== "pan" && (
          <div className="flex gap-1">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`h-5 w-5 rounded-full border-2 transition-all ${
                  color === c ? "scale-110 border-white" : "border-zinc-700"
                }`}
              />
            ))}
          </div>
        )}
        {!readOnly && (
          <>
            <div className="h-6 w-px bg-zinc-700" />
            <button
              type="button"
              onClick={() => setAnnotations((prev) => prev.slice(0, -1))}
              className="px-2 text-xs text-zinc-300 hover:text-white"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => setAnnotations([])}
              className="px-2 text-xs text-zinc-300 hover:text-white"
            >
              Clear
            </button>
            <Button
              size="sm"
              onClick={handleSaveAnnotations}
              disabled={isSaving}
              className="ml-auto h-7 text-xs"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ cursor: tool === "pan" ? (isDragging ? "grabbing" : "grab") : "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
}
