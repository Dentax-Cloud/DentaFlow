"use client";

import type { GateSummary } from "@/lib/encounter/types";

function gateTone(value: GateSummary[keyof GateSummary]) {
  switch (value) {
    case "cleared":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "blocked":
      return "bg-rose-50 text-rose-900 ring-rose-200";
    case "pending":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

export function EncounterGateSummary({
  gates,
  footer,
  className,
}: {
  gates: GateSummary;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className ?? "space-y-3"}>
      <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
        Gate summary
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Risk", gates.risk],
            ["Consent", gates.consent],
            ["Insurance", gates.insurance],
            ["Sterilization", gates.sterilization],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className={`rounded-md px-3 py-2 text-sm ring-1 ring-inset ${gateTone(value)}`}
          >
            <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
            <div className="font-medium">{value.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {footer}
    </section>
  );
}
