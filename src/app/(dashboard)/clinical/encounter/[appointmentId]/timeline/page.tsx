export const runtime = "nodejs";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { buildTimelineForAppointment } from "@/lib/encounter/compat";
import { encounterWorkspacePath, encounterSpinePath } from "@/lib/clinical/encounter-url";
import { ChairsideTimelineClient } from "./timeline-client";

export default async function ChairsideTimelinePage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const ctx = await requireRouteAccess("clinical_chart", "read");

  const spineOn = isEncounterSpineEnabled(ctx.tenant);
  if (!spineOn) {
    redirect(encounterWorkspacePath(appointmentId, "chart"));
  }

  const data = await buildTimelineForAppointment(appointmentId);
  if (!data) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Module 6 · preview
          </p>
          <h1 className="mt-1 font-serif text-3xl text-slate-900">Chairside timeline</h1>
          <p className="mt-1 text-sm text-slate-600">
            Read-only view of encounter progression
            {data.encounter.source === "compat" ? " (projected from existing chairside data)" : ""}.
          </p>
        </div>
        <Link
          href={encounterSpinePath(appointmentId)}
          className="text-sm text-teal-800 underline-offset-4 hover:underline"
        >
          Back to encounter
        </Link>
      </div>

      <ChairsideTimelineClient
        encounter={data.encounter}
        gates={data.gates}
        events={data.events}
      />
    </div>
  );
}
