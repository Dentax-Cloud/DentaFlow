"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronDown } from "lucide-react";
import type { PatientVisitHistoryRow } from "@/lib/clinical/load-patient-visit-history";
import { resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";

type Props = {
  visits: PatientVisitHistoryRow[];
  timezone?: string | null;
};

export function EncounterVisitHistoryPanel({ visits, timezone }: Props) {
  const tz = resolveClinicTimezone(timezone);
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>Visit history</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3">
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed visits recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {visits.map((visit) => (
              <li key={visit.appointmentId} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {formatInTimeZone(new Date(visit.date), tz, "MMM d, yyyy · h:mm a")}
                    </p>
                    {visit.providerName ? (
                      <p className="text-xs text-muted-foreground">{visit.providerName}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/appointments?appointmentId=${visit.appointmentId}`}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    View appointment
                  </Link>
                </div>
                {visit.procedures.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {visit.procedures.join(" · ")}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No procedures recorded</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
