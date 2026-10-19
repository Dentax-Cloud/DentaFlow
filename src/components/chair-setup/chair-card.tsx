"use client";

import type { ChairDisplayStatus, ChairType, SetupItem } from "@/lib/chair-setup/types";
import {
  CHAIR_TYPE_ICONS,
  CHAIR_TYPE_LABELS,
} from "@/lib/chair-setup/constants";
import {
  buildCategorySummaries,
  canSetupTray,
} from "@/lib/chair-setup/helpers";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";

type DoctorInfo = {
  firstName: string | null;
  lastName: string | null;
};

type ScheduleInfo = {
  startTime: string;
  endTime: string;
};

type ChairSetupInfo = {
  setupItems: SetupItem[];
  consumedItems: SetupItem[];
  returnedItems: Array<{ inventoryItemId: string; qty: number }>;
  setupCost: number;
  template: { name: string } | null;
  setupByName?: string | null;
  createdAt?: string;
  checkedItemIds?: string[];
  readyAt?: string | null;
  readyByName?: string | null;
};

type Props = {
  chair: {
    id: string;
    name: string;
    chairType: string;
    roomName: string | null;
    colorCode: string;
  };
  chairStatus: ChairDisplayStatus;
  assignedDoctor: DoctorInfo | null;
  schedule: ScheduleInfo | null;
  apptCount: number;
  completedCount: number;
  setup: ChairSetupInfo | null;
  sessionOpen: boolean;
  currency: string;
  userRole: string;
  onSetup: () => void;
  onViewDetails: () => void;
  onReturnItems: () => void;
};

function doctorInitials(d: DoctorInfo) {
  return `${d.firstName?.[0] ?? ""}${d.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function doctorFullName(d: DoctorInfo) {
  return [d.firstName, d.lastName].filter(Boolean).join(" ");
}

export function ChairCard({
  chair,
  chairStatus,
  assignedDoctor,
  schedule,
  apptCount,
  completedCount,
  setup,
  sessionOpen,
  currency,
  userRole,
  onSetup,
  onViewDetails,
  onReturnItems,
}: Props) {
  const chairType = chair.chairType as ChairType;
  const categoryGroups = setup
    ? buildCategorySummaries(
        setup.setupItems,
        setup.consumedItems,
        setup.returnedItems,
      )
    : [];

  return (
    <div
      className="overflow-hidden rounded-xl border-2"
      style={{ borderColor: chair.colorCode }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ backgroundColor: chair.colorCode }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{CHAIR_TYPE_ICONS[chairType] ?? "🪑"}</span>
          <div>
            <p className="text-sm font-bold">{chair.name}</p>
            <p className="text-xs opacity-80">
              {chair.roomName ?? "Main floor"} · {CHAIR_TYPE_LABELS[chairType] ?? chair.chairType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {setup?.readyAt && (
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-green-700">
              ✓ Prepped
            </span>
          )}
          <StatusBadge status={chairStatus} />
        </div>
      </div>

      <div className="border-b bg-gray-50 px-4 py-3">
        {assignedDoctor ? (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {doctorInitials(assignedDoctor)}
            </div>
            <div>
              <p className="text-sm font-medium">Dr. {doctorFullName(assignedDoctor)}</p>
              {schedule && (
                <p className="text-xs text-muted-foreground">
                  {schedule.startTime} – {schedule.endTime}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">No doctor assigned today</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 border-b px-4 py-2 text-center">
        <div>
          <p className="text-lg font-bold text-blue-600">{apptCount}</p>
          <p className="text-xs text-muted-foreground">Appointments</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-600">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: chair.colorCode }}>
            {currency} {(setup?.setupCost ?? 0).toFixed(0)}
          </p>
          <p className="text-xs text-muted-foreground">Setup cost</p>
        </div>
      </div>

      <div className="border-b px-4 py-2">
        {setup ? (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {categoryGroups.map((cat) => (
                <span
                  key={cat.key}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    cat.hasLowStock
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {cat.icon} {cat.label}: {cat.remaining}/{cat.setup}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              📋 {setup.template?.name ?? "Custom setup"}
              {setup.setupByName && ` · Set up by ${setup.setupByName}`}
            </p>
            {setup.readyAt ? (
              <p className="text-xs font-medium text-green-700">
                ✓ Chair ready{setup.readyByName && ` — confirmed by ${setup.readyByName}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Prep checklist: {(setup.checkedItemIds ?? []).length}/{setup.setupItems.length}{" "}
                checked
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs font-medium text-orange-600">⚠ Tray not set up</p>
        )}
      </div>

      <div className="flex gap-2 px-4 py-3">
        {!setup && canSetupTray(userRole) ? (
          <Button className="flex-1" size="sm" onClick={onSetup} disabled={!sessionOpen}>
            Set up tray
          </Button>
        ) : setup ? (
          <>
            <Button className="flex-1" size="sm" variant="outline" onClick={onViewDetails}>
              View details
            </Button>
            {sessionOpen && canSetupTray(userRole) && (
              <Button
                className="flex-1 border-orange-200 text-orange-700"
                size="sm"
                variant="outline"
                onClick={onReturnItems}
              >
                Return items
              </Button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
