"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActiveChairsideSessionRow = {
  id: string;
  patientId: string;
  appointmentId: string | null;
  startedAt: string;
  patientName: string;
};

type Props = {
  sessions: ActiveChairsideSessionRow[];
  compact?: boolean;
  className?: string;
};

function resumeHref(session: ActiveChairsideSessionRow) {
  const params = new URLSearchParams({ patientId: session.patientId, sessionId: session.id });
  if (session.appointmentId) params.set("appointmentId", session.appointmentId);
  return `/clinical/chairside?${params.toString()}`;
}

export function ResumeChairsideBanner({ sessions, compact = false, className }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || sessions.length === 0) return null;

  return (
    <div
      className={cn(
        "relative rounded-lg border border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded p-1 text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className={cn("flex items-start gap-2", compact ? "pr-6" : "pr-8")}>
        <Activity className={cn("mt-0.5 shrink-0", compact ? "h-4 w-4" : "h-5 w-5")} />
        <div className="min-w-0 flex-1 space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2",
                sessions.length > 1 && "border-b border-sky-200/80 pb-2 last:border-0 last:pb-0 dark:border-sky-800",
              )}
            >
              <p className={cn("text-sm", compact && "text-xs")}>
                You have an active chairside session with{" "}
                <span className="font-semibold">{session.patientName}</span>
                {" — "}
                started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}.
              </p>
              <Button size={compact ? "sm" : "sm"} variant="secondary" asChild>
                <Link href={resumeHref(session)}>Resume</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
