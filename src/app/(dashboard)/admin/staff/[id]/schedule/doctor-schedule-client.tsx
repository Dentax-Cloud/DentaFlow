"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  saveDoctorSchedule,
  addScheduleException,
} from "@/app/(dashboard)/features/appointments/appointment-booking-actions";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type ScheduleDay = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  breaks: Array<{ start: string; end: string }>;
  slotDurationMins: number;
  bufferMins: number;
  maxAppointments: number | null;
};

type Exception = {
  id: string;
  date: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

type ExceptionType = "OFF" | "MODIFIED" | "EXTRA_HOURS";

export default function DoctorScheduleClient({
  doctorId,
  doctorName,
  schedule: initialSchedule,
  exceptions: initialExceptions,
}: {
  doctorId: string;
  doctorName: string;
  schedule: ScheduleDay[];
  exceptions: Exception[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [schedule, setSchedule] = useState<ScheduleDay[]>(initialSchedule);
  const [showAddException, setShowAddException] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({
    date: "",
    type: "OFF" as ExceptionType,
    startTime: "09:00",
    endTime: "17:00",
    reason: "",
  });

  function updateDay(dayOfWeek: number, updates: Partial<ScheduleDay>) {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...updates } : d)),
    );
  }

  async function handleSaveSchedule() {
    startTransition(async () => {
      try {
        await saveDoctorSchedule({ doctorId, schedule });
        toast.success("Schedule saved");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save";
        toast.error(message);
      }
    });
  }

  async function handleAddException() {
    if (!exceptionForm.date) {
      toast.error("Please select a date");
      return;
    }
    startTransition(async () => {
      try {
        await addScheduleException({
          doctorId,
          date: exceptionForm.date,
          type: exceptionForm.type,
          startTime:
            exceptionForm.type !== "OFF" ? exceptionForm.startTime : undefined,
          endTime:
            exceptionForm.type !== "OFF" ? exceptionForm.endTime : undefined,
          reason: exceptionForm.reason || undefined,
        });
        toast.success("Exception added");
        setShowAddException(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add exception";
        toast.error(message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{doctorName} — Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set working hours, breaks and slot configuration
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b bg-gray-50 px-5 py-4">
          <h2 className="font-semibold">Weekly Schedule</h2>
        </div>

        <div className="divide-y">
          {schedule.map((day) => (
            <div
              key={day.dayOfWeek}
              className={`px-5 py-4 ${
                !day.isWorkingDay ? "bg-gray-50 opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex w-36 items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateDay(day.dayOfWeek, {
                        isWorkingDay: !day.isWorkingDay,
                      })
                    }
                    className={`relative h-5 w-10 rounded-full transition-colors ${
                      day.isWorkingDay ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        day.isWorkingDay ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium">
                    {DAY_NAMES[day.dayOfWeek]}
                  </span>
                </div>

                {day.isWorkingDay ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          updateDay(day.dayOfWeek, { startTime: e.target.value })
                        }
                        className="rounded border px-2 py-1.5 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          updateDay(day.dayOfWeek, { endTime: e.target.value })
                        }
                        className="rounded border px-2 py-1.5 text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Break:
                      </span>
                      {day.breaks.length > 0 ? (
                        <>
                          <input
                            type="time"
                            value={day.breaks[0]?.start ?? "13:00"}
                            onChange={(e) => {
                              const breaks = [...day.breaks];
                              breaks[0] = { ...breaks[0], start: e.target.value };
                              updateDay(day.dayOfWeek, { breaks });
                            }}
                            className="rounded border px-2 py-1.5 text-sm"
                          />
                          <span className="text-xs">-</span>
                          <input
                            type="time"
                            value={day.breaks[0]?.end ?? "14:00"}
                            onChange={(e) => {
                              const breaks = [...day.breaks];
                              breaks[0] = { ...breaks[0], end: e.target.value };
                              updateDay(day.dayOfWeek, { breaks });
                            }}
                            className="rounded border px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateDay(day.dayOfWeek, { breaks: [] })
                            }
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateDay(day.dayOfWeek, {
                              breaks: [{ start: "13:00", end: "14:00" }],
                            })
                          }
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Add break
                        </button>
                      )}
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Slot
                        </span>
                        <select
                          value={day.slotDurationMins}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, {
                              slotDurationMins: Number(e.target.value),
                            })
                          }
                          className="rounded border bg-white px-2 py-1 text-xs"
                        >
                          {[15, 20, 30, 45, 60].map((m) => (
                            <option key={m} value={m}>
                              {m}m
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Buffer
                        </span>
                        <select
                          value={day.bufferMins}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, {
                              bufferMins: Number(e.target.value),
                            })
                          }
                          className="rounded border bg-white px-2 py-1 text-xs"
                        >
                          {[0, 5, 10, 15, 20].map((m) => (
                            <option key={m} value={m}>
                              {m}m
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="text-sm italic text-muted-foreground">
                    Day off
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t bg-gray-50 px-5 py-4">
          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save schedule"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b bg-gray-50 px-5 py-4">
          <h2 className="font-semibold">Schedule Exceptions</h2>
          <button
            type="button"
            onClick={() => setShowAddException(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add exception
          </button>
        </div>

        {initialExceptions.length === 0 && !showAddException ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No upcoming exceptions. Add leave or modified hours here.
          </div>
        ) : (
          <div className="divide-y">
            {initialExceptions.map((exc) => (
              <div
                key={exc.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {new Date(exc.date + "T12:00:00").toLocaleDateString(
                      "en-AE",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {exc.type}
                    {exc.type !== "OFF" &&
                      exc.startTime &&
                      ` · ${exc.startTime} - ${exc.endTime}`}
                    {exc.reason && ` · ${exc.reason}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    exc.type === "OFF"
                      ? "bg-red-100 text-red-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {exc.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {showAddException && (
          <div className="space-y-3 border-t bg-blue-50 px-5 py-4">
            <h3 className="text-sm font-medium">Add Exception</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Date</label>
                <input
                  type="date"
                  value={exceptionForm.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setExceptionForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Type</label>
                <select
                  value={exceptionForm.type}
                  onChange={(e) =>
                    setExceptionForm((p) => ({
                      ...p,
                      type: e.target.value as ExceptionType,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  <option value="OFF">Day off / Leave</option>
                  <option value="MODIFIED">Modified hours</option>
                  <option value="EXTRA_HOURS">Extra hours</option>
                </select>
              </div>
            </div>

            {exceptionForm.type !== "OFF" && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium">Start</label>
                  <input
                    type="time"
                    value={exceptionForm.startTime}
                    onChange={(e) =>
                      setExceptionForm((p) => ({
                        ...p,
                        startTime: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium">End</label>
                  <input
                    type="time"
                    value={exceptionForm.endTime}
                    onChange={(e) =>
                      setExceptionForm((p) => ({
                        ...p,
                        endTime: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium">Reason (optional)</label>
              <input
                value={exceptionForm.reason}
                onChange={(e) =>
                  setExceptionForm((p) => ({ ...p, reason: e.target.value }))
                }
                placeholder="Annual leave, Conference, etc."
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddException(false)}
                className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddException}
                disabled={isPending || !exceptionForm.date}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save exception"}
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to staff
      </button>
    </div>
  );
}
