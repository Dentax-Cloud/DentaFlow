"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SpineStageCard({
  id,
  title,
  summary,
  state,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  state: "current" | "completed" | "upcoming";
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const contentId = useId();
  const hasContent = children != null && children !== false;
  const initialOpen =
    defaultOpen ?? (state === "current" ? true : state === "completed" ? false : false);
  const [open, setOpen] = useState(initialOpen);

  // Expand when this stage becomes current (status advance).
  useEffect(() => {
    if (state === "current") setOpen(true);
  }, [state]);

  const canExpand = hasContent || state !== "upcoming";
  const mutedUpcoming = state === "upcoming" && !hasContent;

  return (
    <section
      data-stage={id}
      className={cn(
        "rounded-xl border border-slate-200 bg-white",
        state === "current" && "ring-2 ring-teal-500/40",
        state === "upcoming" && "opacity-60",
        mutedUpcoming && "opacity-50",
      )}
    >
      <button
        type="button"
        disabled={!canExpand || (state === "upcoming" && !hasContent)}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => {
          if (!canExpand || (state === "upcoming" && !hasContent)) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "flex w-full items-start justify-between gap-3 px-4 py-3 text-left",
          "min-h-10 disabled:cursor-default",
        )}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {!open && summary ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">{summary}</p>
          ) : null}
        </div>
        {hasContent ? (
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        ) : null}
      </button>
      {hasContent && open ? (
        <div id={contentId} className="border-t border-slate-100 px-4 py-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
