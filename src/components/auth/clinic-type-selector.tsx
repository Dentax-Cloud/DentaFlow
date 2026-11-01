"use client";

import { cn } from "@/lib/utils";

type Props = {
  value: "solo" | "practice";
  onChange: (value: "solo" | "practice") => void;
};

export function ClinicTypeSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-white">Clinic type</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange("solo")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            value === "solo"
              ? "border-sky-500 bg-sky-500/10"
              : "border-white/10 bg-zinc-900/50 hover:border-white/20",
          )}
        >
          <p className="font-semibold text-white">Solo Doctor</p>
          <p className="mt-1 text-xs text-zinc-400">
            One doctor manages the complete clinic. Simplified, action-oriented experience.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange("practice")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            value === "practice"
              ? "border-sky-500 bg-sky-500/10"
              : "border-white/10 bg-zinc-900/50 hover:border-white/20",
          )}
        >
          <p className="font-semibold text-white">Practice / Group</p>
          <p className="mt-1 text-xs text-zinc-400">
            Multiple staff and roles. Full multi-role workspace.
          </p>
        </button>
      </div>
    </div>
  );
}
