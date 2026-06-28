"use client";

import type { ChairDisplayStatus } from "@/lib/chair-setup/types";
import {
  canCloseDay,
  canOpenDay,
} from "@/lib/chair-setup/helpers";
import { Button } from "@/components/ui/button";

type SessionInfo = {
  status: string;
  openedAt: string | null;
  openedByName: string | null;
  closedAt: string | null;
};

type Props = {
  session: SessionInfo | null;
  readyCount: number;
  inUseCount: number;
  notSetupCount: number;
  userRole: string;
  onOpenDay: () => void;
  onCloseDay: () => void;
  isPending: boolean;
};

export function DayStatusBar({
  session,
  readyCount,
  inUseCount,
  notSetupCount,
  userRole,
  onOpenDay,
  onCloseDay,
  isPending,
}: Props) {
  const isOpen = session?.status === "OPEN";
  const isClosed = session?.status === "CLOSED";

  return (
    <div
      className={`sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 ${
        isOpen ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full ${
            isOpen ? "animate-pulse bg-green-500" : "bg-gray-400"
          }`}
        />
        <div>
          <span className="text-sm font-semibold">
            {isOpen
              ? "● Day Session Open"
              : isClosed
                ? "⬤ Day Session Closed"
                : "○ Day Not Started"}
          </span>
          {session?.openedAt && (
            <span className="ml-2 text-xs text-muted-foreground">
              Opened at{" "}
              {new Date(session.openedAt).toLocaleTimeString("en-AE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {session.openedByName && ` by ${session.openedByName}`}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border bg-white px-3 py-1 text-xs">
          🟢 {readyCount} Ready
        </span>
        <span className="rounded-full border bg-white px-3 py-1 text-xs">
          🔵 {inUseCount} In use
        </span>
        <span className="rounded-full border bg-white px-3 py-1 text-xs">
          🟡 {notSetupCount} Not set up
        </span>

        {(!session || session.status === "PENDING") && canOpenDay(userRole) ? (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={onOpenDay}
            disabled={isPending}
          >
            Open Day →
          </Button>
        ) : isOpen && canCloseDay(userRole) ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={onCloseDay}
            disabled={isPending}
          >
            Close Day
          </Button>
        ) : isClosed && session?.closedAt ? (
          <span className="text-sm text-muted-foreground">
            Closed at{" "}
            {new Date(session.closedAt).toLocaleTimeString("en-AE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
