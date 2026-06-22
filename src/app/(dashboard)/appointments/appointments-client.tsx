"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parse, startOfWeek, getDay } from "date-fns";
import {
  Calendar as BigCalendarBase,
  dateFnsLocalizer,
  type Event,
  type SlotInfo,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  updateAppointmentChair,
  updateAppointmentStatus,
  updateAppointmentTime,
} from "@/app/(dashboard)/features/appointments/actions";
import { getPusherClient, isRealtimeAvailable, tenantChannel } from "@/lib/pusher-client";
import { Radio, WifiOff } from "lucide-react";
import Link from "next/link";
import { BookAppointmentDialog } from "@/components/appointments/book-appointment-dialog";
import type { Appointment, Chair, Patient, Doctor, User } from "@prisma/client";
import { AppointmentStatus } from "@prisma/client";

type AppointmentWithRelations = Appointment & {
  patient: Patient;
  chair: Chair | null;
  doctor: (Doctor & { user: User }) | null;
};

type DoctorWithRelations = Doctor & { user: User };

type ChairWithRelations = Chair & {
  doctor: DoctorWithRelations | null;
  appointments: Appointment[];
};

const STATUS_FLOW: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "ARRIVED",
  "IN_CHAIR",
  "COMPLETED",
  "INVOICED",
];

const statusLabel: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  ARRIVED: "Checked in",
  IN_CHAIR: "In chair",
  COMPLETED: "Completed",
  INVOICED: "Invoiced",
  CANCELED: "Canceled",
  NO_SHOW: "No show",
};

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  SCHEDULED: "secondary",
  CONFIRMED: "default",
  ARRIVED: "warning",
  IN_CHAIR: "warning",
  COMPLETED: "success",
  INVOICED: "success",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

export function AppointmentsClient({
  initialAppointments,
  chairs,
  patients,
  doctors,
  tenantId,
  defaultPatientId,
}: {
  initialAppointments: AppointmentWithRelations[];
  chairs: ChairWithRelations[];
  patients: Patient[];
  doctors: DoctorWithRelations[];
  tenantId: string;
  defaultPatientId?: string;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "board">("calendar");
  const [slotStart, setSlotStart] = useState<Date | undefined>();
  const [slotEnd, setSlotEnd] = useState<Date | undefined>();
  const realtimeEnabled = isRealtimeAvailable();

  const BigCalendar = useMemo(() => withDragAndDrop(BigCalendarBase), []);

  const localizer = useMemo(() => {
    return dateFnsLocalizer({
      format,
      parse,
      startOfWeek,
      getDay,
      locales: {},
    });
  }, []);

  const events: Event[] = useMemo(() => {
    return appointments.map((a) => ({
      title: `${a.patient.firstName} ${a.patient.lastName} — ${a.title}`,
      start: new Date(a.startTime),
      end: new Date(a.endTime),
      resource: a,
    }));
  }, [appointments]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = tenantChannel(tenantId);
    const channel = pusher.subscribe(channelName);
    channel.bind("appointment:updated", (data: AppointmentWithRelations) => {
      setAppointments((prev) => {
        const idx = prev.findIndex((a) => a.id === data.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data;
          return next;
        }
        return [...prev, data];
      });
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [tenantId]);

  async function setStatus(id: string, status: AppointmentStatus) {
    const result = await updateAppointmentStatus({ id, status });
    if (result.success) {
      toast.success(`Status: ${statusLabel[status] ?? status}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function renderStatusActions(apt: AppointmentWithRelations) {
    const actions: { label: string; status: AppointmentStatus }[] = [];
    if (apt.status === "SCHEDULED" || apt.status === "CONFIRMED") {
      actions.push({ label: "Check in", status: "ARRIVED" });
    }
    if (apt.status === "ARRIVED") {
      actions.push({ label: "Start", status: "IN_CHAIR" });
    }
    if (apt.status === "IN_CHAIR") {
      actions.push({ label: "Complete", status: "COMPLETED" });
    }
    if (apt.status === "COMPLETED") {
      actions.push({ label: "Create invoice", status: "INVOICED" });
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              if (action.label === "Create invoice") {
                window.location.href = `/clinical?patientId=${apt.patientId}&appointmentId=${apt.id}`;
                return;
              }
              void setStatus(apt.id, action.status);
            }}
          >
            {action.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/clinical?patientId=${apt.patientId}&appointmentId=${apt.id}`}>
            Open clinical
          </Link>
        </Button>
      </div>
    );
  }

  async function assignChair(appointmentId: string, chairId: string | null) {
    const result = await updateAppointmentChair({ id: appointmentId, chairId });
    if (result.success) {
      toast.success(chairId ? "Assigned to chair" : "Unassigned from chair");
    } else {
      toast.error(result.error);
    }
  }

  async function rescheduleAppointment(
    id: string,
    start: Date,
    end: Date,
  ) {
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // optimistic
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, startTime: start, endTime: end } : a)),
    );

    const result = await updateAppointmentTime({
      id,
      startTime: startIso,
      endTime: endIso,
    });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Appointment rescheduled");
  }

  const chairsWithLiveAppointments = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const live = appointments.filter((a) => {
      const st = new Date(a.startTime);
      return st >= todayStart && st <= todayEnd && a.status !== "CANCELED";
    });

    return chairs.map((c) => ({
      chair: c,
      liveAppointments: live.filter((a) => a.chairId === c.id),
    }));
  }, [appointments, chairs]);

  return (
    <div className="space-y-6">
      {!realtimeEnabled && (
        <div
          className="flex items-start gap-3 rounded-lg border border-dashed border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"
          role="status"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">Real-time sync is off</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
              Calendar and chair board still work — changes save normally. Live updates across
              devices require Pusher credentials or the Professional plan.
            </p>
          </div>
        </div>
      )}

      {realtimeEnabled && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-emerald-600" />
          Live updates enabled
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">Calendar & chair board</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BookAppointmentDialog
            patients={patients}
            doctors={doctors}
            chairs={chairs}
            defaultPatientId={defaultPatientId}
            defaultStart={slotStart}
            defaultEnd={slotEnd}
            onCreated={() => router.refresh()}
          />
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            onClick={() => setView("calendar")}
          >
            Calendar
          </Button>
          <Button
            variant={view === "board" ? "default" : "outline"}
            onClick={() => setView("board")}
          >
            Chair board
          </Button>
        </div>
      </div>

      {view === "calendar" && (
        <Card>
          <CardHeader>
            <CardTitle>Week view</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[70vh]">
              <BigCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                views={["week", "day", "agenda"]}
                defaultView="week"
                selectable
                resizable
                onEventDrop={({ event, start, end }) => {
                  const apt = (event as any).resource as AppointmentWithRelations | undefined;
                  if (!apt || !start || !end) return;
                  void rescheduleAppointment(apt.id, new Date(start), new Date(end));
                }}
                onEventResize={({ event, start, end }) => {
                  const apt = (event as any).resource as AppointmentWithRelations | undefined;
                  if (!apt || !start || !end) return;
                  void rescheduleAppointment(apt.id, new Date(start), new Date(end));
                }}
                onSelectSlot={(slot: SlotInfo) => {
                  if (!slot.start || !slot.end) return;
                  setSlotStart(new Date(slot.start));
                  setSlotEnd(new Date(slot.end));
                  toast.message("Book this slot", {
                    description: "Click New appointment to schedule a patient in the selected time.",
                  });
                }}
                onSelectEvent={(evt) => {
                  const apt = evt.resource as AppointmentWithRelations | undefined;
                  if (!apt) return;
                  toast.message(`${apt.patient.firstName} ${apt.patient.lastName}`, {
                    description: `${format(new Date(apt.startTime), "EEE, MMM d · h:mm a")} — ${apt.title}`,
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {view === "board" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Chair board</h2>
            <p className="text-sm text-muted-foreground">
              Drag an appointment onto a chair to assign it.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {chairsWithLiveAppointments.map(({ chair, liveAppointments }) => {
              const active = liveAppointments.find((a) =>
                ["IN_CHAIR", "ARRIVED"].includes(a.status),
              );
              return (
                <Card
                  key={chair.id}
                  className={active ? "border-dental" : ""}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (!id) return;
                    await assignChair(id, chair.id);
                    setDraggingId(null);
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{chair.name}</CardTitle>
                    {chair.doctor && (
                      <p className="text-xs text-muted-foreground">
                        Dr. {chair.doctor.user.firstName} {chair.doctor.user.lastName}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {active ? (
                      <Badge variant="warning">{active.status.replace("_", " ")}</Badge>
                    ) : (
                      <Badge variant="success">Available</Badge>
                    )}

                    <div className="pt-2 space-y-2">
                      {liveAppointments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Drop an appointment here
                        </p>
                      ) : (
                        liveAppointments.map((a) => (
                          <div
                            key={a.id}
                            className="rounded-md border bg-muted/30 p-2 text-xs"
                          >
                            <div className="font-medium">
                              {a.patient.firstName} {a.patient.lastName}
                            </div>
                            <div className="text-muted-foreground">
                              {format(new Date(a.startTime), "h:mm a")} — {a.title}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Card
              className={draggingId ? "border-dashed" : ""}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (!id) return;
                await assignChair(id, null);
                setDraggingId(null);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Unassigned</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Drop here to remove chair assignment.
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Appointments (drag to assign)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", apt.id);
                    setDraggingId(apt.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className="cursor-grab rounded-lg border bg-card p-3 active:cursor-grabbing"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {apt.patient.firstName} {apt.patient.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.startTime), "EEE, MMM d · h:mm a")} — {apt.title}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={statusVariant[apt.status] ?? "secondary"}>
                        {statusLabel[apt.status] ?? apt.status.replace("_", " ")}
                      </Badge>
                      {apt.status !== "CANCELED" && apt.status !== "NO_SHOW" && apt.status !== "INVOICED" &&
                        renderStatusActions(apt)}
                    </div>
                  </div>
                </div>
              ))}
              {appointments.length === 0 && (
                <p className="text-center text-muted-foreground py-6">
                  No appointments
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">This week</h2>
        <div className="space-y-2">
          {appointments.map((apt) => (
            <Card key={apt.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{apt.patient.firstName} {apt.patient.lastName}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(apt.startTime), "EEE, MMM d · h:mm a")} — {apt.title}
                  </p>
                  {apt.noShowRisk && (
                    <Badge variant="warning" className="mt-1">
                      No-show risk: {apt.noShowRisk}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Badge variant={statusVariant[apt.status] ?? "secondary"}>
                    {statusLabel[apt.status] ?? apt.status.replace("_", " ")}
                  </Badge>
                  {apt.status !== "CANCELED" && apt.status !== "NO_SHOW" && apt.status !== "INVOICED" &&
                    renderStatusActions(apt)}
                </div>
              </CardContent>
            </Card>
          ))}
          {appointments.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No appointments this week</p>
          )}
        </div>
      </div>
    </div>
  );
}
