"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { encounterWorkspacePath } from "@/lib/clinical/encounter-url";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatClinicTime, resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";
import type { VisitBoardAppointment } from "@/app/(dashboard)/features/procedure-lines/queries";
import { forceCloseProcedureLine } from "@/app/(dashboard)/features/procedure-lines/actions";

const STALL_STYLES = {
  normal: "border-transparent",
  amber: "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20",
  red: "border-red-500 bg-red-50/70 dark:bg-red-950/20",
} as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  IN_PROGRESS: "default",
  CLOSED: "success",
  VOIDED: "destructive",
  LOCKED: "secondary",
};

type Props = {
  appointments: VisitBoardAppointment[];
  timezone: string;
  canForceClose: boolean;
  highlightAppointmentId?: string | null;
};

export function VisitBoardClient({
  appointments,
  timezone,
  canForceClose,
  highlightAppointmentId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [forceReasonByLine, setForceReasonByLine] = useState<Record<string, string>>({});
  const tz = resolveClinicTimezone(timezone);

  const sorted = useMemo(() => {
    if (!highlightAppointmentId) return appointments;
    return [...appointments].sort((a, b) => {
      if (a.id === highlightAppointmentId) return -1;
      if (b.id === highlightAppointmentId) return 1;
      return 0;
    });
  }, [appointments, highlightAppointmentId]);

  function handleForceClose(lineId: string) {
    const reason = (forceReasonByLine[lineId] ?? "").trim();
    if (!reason) {
      toast.error("Enter a reason before force-closing.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await forceCloseProcedureLine(lineId, reason);
        toast.success(
          result.completionApplied
            ? "Line force-closed — appointment marked completed."
            : "Line force-closed.",
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Force-close failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visit board</h1>
        <p className="text-muted-foreground">
          Today&apos;s in-chair visits and open procedure lines — operational view only.
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No active visits with open procedure lines or in-chair appointments right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((appt) => (
            <Card
              key={appt.id}
              className={
                appt.id === highlightAppointmentId ? "ring-2 ring-primary/40" : undefined
              }
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{appt.patientName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatClinicTime(new Date(appt.startTime), tz)} ·{" "}
                      {appt.chairName ?? "Unassigned chair"} · {appt.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  {appt.patientId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={encounterWorkspacePath(appt.id)}>
                        Open encounter
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {appt.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No procedure lines yet.</p>
                ) : (
                  appt.lines.map((line) => {
                    const ownerLabel =
                      line.ownerType === "STORE"
                        ? "Store"
                        : (line.ownerName ?? "Unassigned");
                    const stallStyle =
                      line.status === "IN_PROGRESS"
                        ? STALL_STYLES[line.stallLevel]
                        : STALL_STYLES.normal;
                    const showWarnIcon =
                      line.status === "IN_PROGRESS" && line.stallLevel !== "normal";

                    return (
                      <div
                        key={line.id}
                        className={`rounded-md border p-3 ${stallStyle}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {ownerLabel} — {line.procedureName ?? line.procedureCode ?? "Procedure"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {line.status === "IN_PROGRESS" ? (
                                <>
                                  in progress, {line.openDurationLabel}
                                  {showWarnIcon ? (
                                    <span className="ml-1 inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      {line.stallLevel === "red" ? "Critical" : "Stalled"}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                line.status.toLowerCase().replace(/_/g, " ")
                              )}
                            </p>
                          </div>
                          <Badge variant={STATUS_VARIANT[line.status] ?? "secondary"}>
                            {line.status}
                          </Badge>
                        </div>

                        {canForceClose && line.status === "IN_PROGRESS" ? (
                          <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                            <div className="min-w-[220px] flex-1">
                              <Label htmlFor={`force-reason-${line.id}`} className="text-xs">
                                Force-close reason (admin)
                              </Label>
                              <Input
                                id={`force-reason-${line.id}`}
                                value={forceReasonByLine[line.id] ?? ""}
                                onChange={(e) =>
                                  setForceReasonByLine((prev) => ({
                                    ...prev,
                                    [line.id]: e.target.value,
                                  }))
                                }
                                placeholder="Required accountability note"
                                className="mt-1"
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={
                                isPending || !(forceReasonByLine[line.id] ?? "").trim()
                              }
                              onClick={() => handleForceClose(line.id)}
                            >
                              Force close
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
