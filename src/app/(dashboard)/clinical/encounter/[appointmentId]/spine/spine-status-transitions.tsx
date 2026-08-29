"use client";

import type { EncounterStatus, GateSummary } from "@/lib/encounter/types";
import { spineForwardTransitionBlocker } from "@/lib/encounter/stage-transition-blockers";

function statusLabel(value: EncounterStatus) {
  return value.replaceAll("_", " ").toUpperCase();
}

const btn =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btn} bg-teal-800 text-white hover:bg-teal-900`;

export function SpineStatusTransitions({
  nextStatuses,
  write,
  examCompletedAt,
  examinedByStaffId,
  gates,
  showEmptyHint = true,
  onAdvance,
}: {
  nextStatuses: EncounterStatus[];
  write: boolean;
  examCompletedAt: string | null;
  examinedByStaffId: string | null;
  gates: GateSummary;
  showEmptyHint?: boolean;
  onAdvance: (to: EncounterStatus) => void;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
        Status
      </h2>
      <div className="flex flex-wrap gap-3">
        {nextStatuses.map((to) => {
          const blocker = spineForwardTransitionBlocker({
            toStatus: to,
            examCompletedAt,
            examinedByStaffId,
            gates,
          });
          return (
            <div key={to} className="max-w-sm space-y-1">
              <button
                type="button"
                className={btnPrimary}
                disabled={!write || Boolean(blocker)}
                title={blocker ?? undefined}
                onClick={() => {
                  if (blocker) return;
                  onAdvance(to);
                }}
              >
                → {statusLabel(to)}
              </button>
              {blocker ? (
                <p className="text-xs text-amber-800">{blocker}</p>
              ) : null}
            </div>
          );
        })}
        {nextStatuses.length === 0 && showEmptyHint ? (
          <p className="text-sm text-slate-500">No forward transitions available.</p>
        ) : null}
      </div>
    </section>
  );
}
