"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft } from "lucide-react";
import { PersonAvatar } from "@/components/profile/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";

/** Calendar-date age in the clinic timezone — avoids SSR/client TZ drift on DOB. */
function computeAge(
  dateOfBirth: string | null | undefined,
  timezone: string,
): number | null {
  if (!dateOfBirth) return null;
  const dobStr = dateOfBirth.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const [y, m, d] = dobStr.split("-").map(Number);
  const todayStr = formatInTimeZone(new Date(), resolveClinicTimezone(timezone), "yyyy-MM-dd");
  const [ty, tm, td] = todayStr.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age >= 0 ? age : null;
}

type Props = {
  patient: {
    firstName: string;
    lastName: string;
    patientNumber: string;
    dateOfBirth: string | null;
    photoUrl: string | null;
    allergies: string[];
    bloodGroup: string | null;
    medicalHistory: string | null;
  };
  appointment: {
    status: string;
    startTime: string;
    chairName: string | null;
    doctorName: string | null;
    ref: string | null;
  };
  /** Tenant.timezone — must match on server and client for hydration-safe formatting. */
  timezone?: string | null;
};

export function EncounterPatientHeader({ patient, appointment, timezone }: Props) {
  const patientLabel = `${patient.firstName} ${patient.lastName}`.trim();
  const tz = resolveClinicTimezone(timezone);
  const age = computeAge(patient.dateOfBirth, tz);
  // Explicit clinic TZ (not browser/server local) — fixes React #418 text mismatch.
  const apptTime = formatInTimeZone(new Date(appointment.startTime), tz, "EEE, MMM d · h:mm a");
  const hasAllergies = patient.allergies.length > 0;
  const hasMedicalAlert = Boolean(patient.medicalHistory?.trim());

  return (
    <header className="shrink-0 border-b bg-background px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <PersonAvatar
            photoUrl={patient.photoUrl}
            firstName={patient.firstName}
            lastName={patient.lastName}
            size="lg"
            className="shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{patientLabel}</h1>
              {age != null ? (
                <span className="text-sm text-muted-foreground">{age}y</span>
              ) : null}
              <Badge variant="outline" className="font-mono text-xs">
                #{patient.patientNumber}
              </Badge>
              <Badge variant="secondary">{appointment.status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {apptTime}
              {appointment.chairName ? ` · ${appointment.chairName}` : ""}
              {appointment.doctorName ? ` · ${appointment.doctorName}` : ""}
              {appointment.ref ? ` · ${appointment.ref}` : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/clinical">
            <ArrowLeft className="mr-2 h-4 w-4" />
            End encounter
          </Link>
        </Button>
      </div>

      {(hasAllergies || patient.bloodGroup || hasMedicalAlert) && (
        <div className="mt-3 space-y-2">
          {hasAllergies ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              <span className="font-semibold">Allergies: </span>
              {patient.allergies.join(", ")}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {patient.bloodGroup ? (
              <Badge variant="destructive">Blood group: {patient.bloodGroup}</Badge>
            ) : null}
            {hasMedicalAlert ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Medical history: </span>
                {patient.medicalHistory}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
