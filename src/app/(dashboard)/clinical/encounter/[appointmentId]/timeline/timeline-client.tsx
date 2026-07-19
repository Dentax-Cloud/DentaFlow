"use client";

import type { CompatEncounter, GateSummary, TimelineEvent } from "@/lib/encounter/types";
import { EncounterGateSummary } from "@/components/clinical/encounter-gate-summary";

function statusLabel(value: string | undefined) {
  if (!value) return null;
  return value.replaceAll("_", " ").toUpperCase();
}

function kindAccent(kind: TimelineEvent["kind"]) {
  switch (kind) {
    case "intake":
      return "border-sky-400";
    case "gate_summary":
      return "border-violet-400";
    case "procedure":
      return "border-teal-500";
    case "handoff":
      return "border-indigo-400";
    case "interrupt":
      return "border-rose-500";
    case "material":
      return "border-amber-500";
    case "image":
      return "border-cyan-500";
    default:
      return "border-slate-300";
  }
}

export function ChairsideTimelineClient({
  encounter,
  gates,
  events,
}: {
  encounter: CompatEncounter;
  gates: GateSummary;
  events: TimelineEvent[];
}) {
  return (
    <div className="space-y-6">
      <EncounterGateSummary
        gates={gates}
        footer={
          <p className="text-xs text-slate-500">
            Encounter status:{" "}
            <span className="font-medium text-slate-800">
              {statusLabel(encounter.status)}
            </span>{" "}
            · source {encounter.source}
          </p>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Timeline
        </h2>
        <ol className="relative space-y-0 border-l border-slate-200 pl-5">
          {events.map((event) => (
            <li key={event.id} className="relative pb-5 last:pb-0">
              <span
                className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 bg-white ${kindAccent(event.kind)}`}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{event.title}</p>
                <time className="text-xs tabular-nums text-slate-500">
                  {new Date(event.at).toLocaleString()}
                </time>
              </div>
              {event.detail ? (
                <p className="mt-0.5 text-sm text-slate-600">{event.detail}</p>
              ) : null}
              {event.status ? (
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                  {statusLabel(event.status)} · {event.kind.replaceAll("_", " ")}
                </p>
              ) : (
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                  {event.kind.replaceAll("_", " ")}
                </p>
              )}
            </li>
          ))}
        </ol>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline events for this visit yet.</p>
        ) : null}
      </section>
    </div>
  );
}
