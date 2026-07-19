"use client";

import { BadgeCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type GateChipStatus =
  | "cleared"
  | "pending"
  | "blocked"
  | "unknown"
  | "overridden";

export function gateStatusTone(status: GateChipStatus): string {
  switch (status) {
    case "cleared":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "blocked":
      return "bg-rose-50 text-rose-900 ring-rose-200";
    case "pending":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "overridden":
      return "bg-violet-50 text-violet-900 ring-violet-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

function StatusIcon({ status }: { status: GateChipStatus }) {
  if (status === "overridden") {
    return <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  if (status === "cleared") {
    return <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  return null;
}

export function GateStatusChip({
  label,
  status,
  className,
}: {
  label: string;
  status: GateChipStatus;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 flex-col gap-0.5 rounded-md px-3 py-2 text-sm ring-1 ring-inset",
        gateStatusTone(status),
        className,
      )}
    >
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="flex items-center gap-1.5 font-medium">
        <StatusIcon status={status} />
        <span>{status.toUpperCase()}</span>
      </div>
    </div>
  );
}
