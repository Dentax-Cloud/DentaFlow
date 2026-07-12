"use client";

import Link from "next/link";
import { formatClinicTime, resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";
import { encounterWorkspacePath } from "@/lib/clinical/encounter-url";
import type { EncounterQueueRow } from "@/lib/clinical/encounter-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  appointments: EncounterQueueRow[];
  timezone: string;
};

export function EncounterQueuePanel({ appointments, timezone }: Props) {
  const tz = resolveClinicTimezone(timezone);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Today&apos;s encounters</CardTitle>
        <p className="text-sm text-muted-foreground">
          Open a patient workspace for arrived or in-chair visits — chart, perio, imaging, and
          treatment plan in one place.
        </p>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No arrived or in-chair patients right now. Check in a patient from Reception or
            Appointments to start an encounter.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {appointments.map((appt) => (
              <li
                key={appt.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{appt.patientName}</span>
                    <Badge variant="secondary">{appt.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatClinicTime(new Date(appt.startTime), tz)}
                    {appt.chairName ? ` · ${appt.chairName}` : ""}
                    {appt.doctorName ? ` · ${appt.doctorName}` : ""}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href={encounterWorkspacePath(appt.id)}>Open encounter</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
