"use client";

import Link from "next/link";
import { encounterSpinePath } from "@/lib/clinical/encounter-url";
import { AlertTriangle } from "lucide-react";

/**
 * Shown on classic `/clinical` when the user arrived from an active spine
 * encounter. Returns them to the spine workspace for that appointment.
 */
export function BackToSpineEncounterBanner({
  appointmentId,
  patientLabel,
}: {
  appointmentId: string;
  patientLabel?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div>
          <p className="font-medium">You left an active encounter spine</p>
          <p className="text-amber-900/80">
            {patientLabel
              ? `Return to ${patientLabel}'s visit to continue gates, procedures, and Close & invoice.`
              : "Return to the encounter spine to continue gates, procedures, and Close & invoice."}{" "}
            Visit billing from this classic page is blocked while that encounter is open.
          </p>
        </div>
      </div>
      <Link
        href={encounterSpinePath(appointmentId)}
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
      >
        Back to encounter
      </Link>
    </div>
  );
}
