"use client";

import type { ChairType } from "@/lib/chair-setup/types";
import {
  CHAIR_TYPE_ICONS,
  CHAIR_TYPE_LABELS,
} from "@/lib/chair-setup/constants";
import { canAssignDoctor, canManageChairs } from "@/lib/chair-setup/helpers";
import { Button } from "@/components/ui/button";

type ChairRow = {
  id: string;
  name: string;
  number: number;
  chairType: string;
  roomName: string | null;
  colorCode: string;
};

type ScheduleRow = {
  id: string;
  chairId: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  shiftType: string;
};

type DoctorRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

type Props = {
  chairs: ChairRow[];
  schedules: ScheduleRow[];
  doctors: DoctorRow[];
  userRole: string;
  onAssign: (chairId: string, shift: string) => void;
  onRemove: (scheduleId: string) => void;
  onEditChair: (chair: ChairRow) => void;
};

const SHIFTS = ["MORNING", "AFTERNOON", "FULL_DAY"] as const;

function doctorName(d: DoctorRow) {
  return [d.firstName, d.lastName].filter(Boolean).join(" ");
}

function doctorInitials(d: DoctorRow) {
  return `${d.firstName?.[0] ?? ""}${d.lastName?.[0] ?? ""}`.toUpperCase();
}

export function ScheduleTable({
  chairs,
  schedules,
  doctors,
  userRole,
  onAssign,
  onRemove,
  onEditChair,
}: Props) {
  const doctorMap = new Map(doctors.map((d) => [d.id, d]));

  function getScheduleForShift(chairId: string, shift: string) {
    return schedules.find((s) => s.chairId === chairId && s.shiftType === shift);
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-4 py-3 text-left font-semibold">Chair</th>
            <th className="px-4 py-3 text-left font-semibold">Type</th>
            <th className="px-4 py-3 text-left font-semibold">Morning Shift</th>
            <th className="px-4 py-3 text-left font-semibold">Afternoon Shift</th>
            <th className="px-4 py-3 text-left font-semibold">Full Day</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {chairs.map((chair) => {
            const chairType = chair.chairType as ChairType;
            return (
              <tr key={chair.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: chair.colorCode }}
                    />
                    <span className="font-medium">{chair.name}</span>
                    {chair.roomName && (
                      <span className="text-xs text-muted-foreground">{chair.roomName}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {CHAIR_TYPE_ICONS[chairType]} {CHAIR_TYPE_LABELS[chairType]}
                  </span>
                </td>
                {SHIFTS.map((shift) => {
                  const schedule = getScheduleForShift(chair.id, shift);
                  const doctor = schedule ? doctorMap.get(schedule.doctorId) : null;
                  return (
                    <td key={shift} className="px-4 py-3">
                      {schedule && doctor ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {doctorInitials(doctor)}
                          </div>
                          <div>
                            <p className="text-xs font-medium">Dr. {doctorName(doctor)}</p>
                            <p className="text-xs text-muted-foreground">
                              {schedule.startTime}–{schedule.endTime}
                            </p>
                          </div>
                          {canAssignDoctor(userRole) && (
                            <button
                              type="button"
                              onClick={() => onRemove(schedule.id)}
                              className="ml-1 text-red-400 hover:text-red-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ) : canAssignDoctor(userRole) ? (
                        <button
                          type="button"
                          onClick={() => onAssign(chair.id, shift)}
                          className="rounded border border-dashed border-blue-300 px-2 py-1 text-xs text-blue-600 hover:border-blue-500 hover:text-blue-800"
                        >
                          + Assign doctor
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  {canManageChairs(userRole) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => onEditChair(chair)}
                    >
                      ⚙ Edit chair
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
