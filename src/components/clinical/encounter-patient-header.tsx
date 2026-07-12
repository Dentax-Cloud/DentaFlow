"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { PersonAvatar } from "@/components/profile/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function computeAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
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
};

export function EncounterPatientHeader({ patient, appointment }: Props) {
  const patientLabel = `${patient.firstName} ${patient.lastName}`.trim();
  const age = computeAge(patient.dateOfBirth);
  const apptTime = format(new Date(appointment.startTime), "EEE, MMM d · h:mm a");
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
