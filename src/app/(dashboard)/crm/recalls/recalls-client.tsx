"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { Recall, Patient } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  markRecallComplete,
  sendRecallReminder,
} from "@/app/(dashboard)/features/crm/actions";
import { Bell, Calendar, Check, Mail } from "lucide-react";

type RecallRow = Recall & {
  patient: Patient;
};

export function RecallsClient({
  overdue,
  upcoming,
}: {
  overdue: RecallRow[];
  upcoming: RecallRow[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleReminder(id: string) {
    setBusyId(id);
    const result = await sendRecallReminder({ recallId: id });
    setBusyId(null);
    if (result.success) toast.success("Reminder sent");
    else toast.error(result.error);
  }

  async function handleComplete(id: string) {
    setBusyId(id);
    const result = await markRecallComplete({ recallId: id });
    setBusyId(null);
    if (result.success) {
      toast.success("Recall marked complete");
      window.location.reload();
    } else {
      toast.error(result.error);
    }
  }

  function RecallRowItem({ recall }: { recall: RecallRow }) {
    const busy = busyId === recall.id;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-sm">
        <div>
          <p className="font-medium">
            {recall.patient.firstName} {recall.patient.lastName}
          </p>
          <p className="text-muted-foreground">
            {recall.type} · Due {formatDate(recall.dueDate)}
            {recall.patient.lastVisitAt && ` · Last visit ${formatDate(recall.patient.lastVisitAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => handleReminder(recall.id)}>
            <Mail className="mr-1 h-3 w-3" />
            Send reminder
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => handleComplete(recall.id)}>
            <Check className="mr-1 h-3 w-3" />
            Complete
          </Button>
          <Button size="sm" asChild>
            <Link href={`/appointments?patientId=${recall.patientId}`}>
              <Calendar className="mr-1 h-3 w-3" />
              Schedule
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recalls</h1>
        <p className="text-muted-foreground">Overdue and upcoming patient recall reminders</p>
      </div>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Bell className="h-4 w-4" />
            Overdue ({overdue.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overdue.length === 0 && (
            <p className="text-sm text-muted-foreground">No overdue recalls.</p>
          )}
          {overdue.map((r) => (
            <RecallRowItem key={r.id} recall={r} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming — next 30 days ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming recalls.</p>
          )}
          {upcoming.map((r) => (
            <div key={r.id} className="flex justify-between border-b pb-2 text-sm">
              <span>
                {r.patient.firstName} {r.patient.lastName} — {r.type}
              </span>
              <Badge variant="outline">{formatDate(r.dueDate)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
