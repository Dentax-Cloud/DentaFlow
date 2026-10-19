"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parse, startOfWeek, getDay, isSameWeek } from "date-fns";
import {
  calendarGridToClinicUtc,
  clinicDateString,
  getClinicDayBounds,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";
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
import { Input } from "@/components/ui/input";
import {
  updateAppointmentChair,
  updateAppointmentStatus,
  updateAppointmentTime,
} from "@/app/(dashboard)/features/appointments/actions";
import { getPusherClient, isRealtimeAvailable, tenantChannel } from "@/lib/pusher-client";
import { Radio, WifiOff, AlertCircle, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { SlotActionMenu } from "@/components/appointments/slot-action-menu";
import { BlockTimeDialog } from "@/components/appointments/block-time-dialog";
import { AppointmentDrawer } from "@/components/appointments/appointment-drawer";
import { useChairsideAppointmentConfirm } from "@/components/clinical/chairside-appointment-confirm";
import { encounterWorkspacePath } from "@/lib/clinical/encounter-url";
import { InsuranceStatusBadge } from "@/components/insurance/insurance-status-badge";
import type { InsuranceVerificationStatus } from "@/lib/insurance/policy-types";
import type { Appointment, Chair, Patient, Doctor, StaffMember, UserRole } from "@prisma/client";
import { AppointmentStatus } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";

type AppointmentWithRelations = Appointment & {
  patient: Patient | null;
  chair: Chair | null;
  doctor: (Doctor & { user: StaffMember }) | null;
  isBlock?: boolean;
};

type DoctorWithRelations = Doctor & { user: StaffMember };

type ChairWithRelations = Chair & {
  doctor: DoctorWithRelations | null;
  appointments: Appointment[];
};

const CALENDAR_HIDDEN_STATUSES = new Set(["CANCELED", "NO_SHOW"]);

function isVisibleOnCalendar(status: string) {
  return !CALENDAR_HIDDEN_STATUSES.has(status);
}

function appointmentMatchesSearch(apt: AppointmentWithRelations, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const patientName = `${apt.patient?.firstName ?? ""} ${apt.patient?.lastName ?? ""}`.toLowerCase();
  const doctorName = apt.doctor?.user
    ? `${apt.doctor.user.firstName ?? ""} ${apt.doctor.user.lastName ?? ""}`.toLowerCase()
    : "";
  const chairName = apt.chair?.name?.toLowerCase() ?? "";
  const title = apt.title?.toLowerCase() ?? "";
  const reference = apt.appointmentRef?.toLowerCase() ?? "";

  return (
    patientName.includes(q) ||
    title.includes(q) ||
    doctorName.includes(q) ||
    chairName.includes(q) ||
    reference.includes(q)
  );
}

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
  doctors,
  tenantId,
  clinicTimezone,
  initialAppointmentId,
  emergencyWaiting = 0,
  emergencyImmediate = 0,
  insuranceStatusMap = {},
  staffRole,
  loadedWeekStart,
  chairReadiness = {},
}: {
  initialAppointments: AppointmentWithRelations[];
  chairs: ChairWithRelations[];
  doctors: DoctorWithRelations[];
  tenantId: string;
  clinicTimezone: string;
  initialAppointmentId?: string;
  emergencyWaiting?: number;
  emergencyImmediate?: number;
  insuranceStatusMap?: Record<string, InsuranceVerificationStatus>;
  staffRole?: UserRole;
  loadedWeekStart: string;
  chairReadiness?: Record<string, { readyAt: string | null; checked: number; total: number }>;
}) {
  const resolvedTimezone = resolveClinicTimezone(clinicTimezone);
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarDate, setCalendarDate] = useState(() => new Date(loadedWeekStart));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "board">("calendar");
  const [slotStart, setSlotStart] = useState<Date | undefined>();
  const [slotEnd, setSlotEnd] = useState<Date | undefined>();
  const [slotMenuOpen, setSlotMenuOpen] = useState(false);
  const [blockTimeOpen, setBlockTimeOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    initialAppointmentId ?? null,
  );
  const realtimeEnabled = isRealtimeAvailable();
  const { confirmBeforeStatusChange, dialog: chairsideDialog } = useChairsideAppointmentConfirm();
  const canUpdateAppointment = staffRole
    ? hasPermission(staffRole, PERMISSIONS.appointments.write)
    : false;
  const canOpenClinical = staffRole
    ? hasPermission(staffRole, PERMISSIONS.clinical_chart.read)
    : false;
  const canStartChairside = staffRole
    ? hasPermission(staffRole, PERMISSIONS.clinical_chart.write)
    : false;

  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  useEffect(() => {
    if (initialAppointmentId) {
      setSelectedAppointmentId(initialAppointmentId);
    }
  }, [initialAppointmentId]);

  const BigCalendar = useMemo(() => withDragAndDrop(BigCalendarBase), []);

  const loadedWeekDate = useMemo(() => new Date(loadedWeekStart), [loadedWeekStart]);

  const searchOutsideLoadedWeek = Boolean(
    searchQuery.trim() &&
      !isSameWeek(calendarDate, loadedWeekDate, { weekStartsOn: 1 }),
  );

  const displayedAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments;
    return appointments.filter((apt) => appointmentMatchesSearch(apt, searchQuery));
  }, [appointments, searchQuery]);

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
    return displayedAppointments
      .filter((a) => isVisibleOnCalendar(a.status))
      .map((a) => ({
      title: a.isBlock
        ? `Blocked: ${a.title}`
        : `${a.patient?.firstName ?? ""} ${a.patient?.lastName ?? ""} — ${a.title}`.trim(),
      start: new Date(a.startTime),
      end: new Date(a.endTime),
      resource: a,
    }));
  }, [displayedAppointments]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = tenantChannel(tenantId);
    const channel = pusher.subscribe(channelName);
    channel.bind("appointment:updated", (data: AppointmentWithRelations) => {
      setAppointments((prev) => {
        if (!isVisibleOnCalendar(data.status)) {
          return prev.filter((a) => a.id !== data.id);
        }
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
    if (apt.isBlock) return null;

    const actions: { label: string; status: AppointmentStatus }[] = [];
    if (canUpdateAppointment) {
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
              if (action.label === "Complete") {
                void confirmBeforeStatusChange(apt.id, action.status, () =>
                  setStatus(apt.id, action.status),
                );
                return;
              }
              void setStatus(apt.id, action.status);
            }}
          >
            {action.label}
          </Button>
        ))}
        {canOpenClinical ? (
          <>
            <Button size="sm" variant="ghost" asChild>
              <Link href={encounterWorkspacePath(apt.id)}>
                Open encounter
              </Link>
            </Button>
            {canStartChairside ? (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => router.push(encounterWorkspacePath(apt.id))}
              >
                Chairside
              </Button>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <Link href={`/clinical/radiographs?patientId=${apt.patientId}&appointmentId=${apt.id}`}>
                Radiographs
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/clinical/photos?patientId=${apt.patientId}&appointmentId=${apt.id}`}>
                Photos
              </Link>
            </Button>
          </>
        ) : null}
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
    const startUtc = calendarGridToClinicUtc(start, resolvedTimezone);
    const endUtc = calendarGridToClinicUtc(end, resolvedTimezone);

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, startTime: startUtc, endTime: endUtc } : a,
      ),
    );

    const result = await updateAppointmentTime({
      id,
      startDate: format(start, "yyyy-MM-dd"),
      startTime: format(start, "HH:mm"),
      endDate: format(end, "yyyy-MM-dd"),
      endTime: format(end, "HH:mm"),
    });

    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }

    toast.success("Appointment rescheduled");
    router.refresh();
  }

  const chairsWithLiveAppointments = useMemo(() => {
    const todayStr = clinicDateString(new Date(), resolvedTimezone);
    const { start: todayStart, end: todayEnd } = getClinicDayBounds(
      todayStr,
      resolvedTimezone,
    );

    const live = appointments.filter((a) => {
      if (!isVisibleOnCalendar(a.status)) return false;
      const st = new Date(a.startTime);
      return st >= todayStart && st <= todayEnd;
    });

    return chairs.map((c) => ({
      chair: c,
      liveAppointments: live.filter((a) => a.chairId === c.id),
    }));
  }, [appointments, chairs, resolvedTimezone]);

  return (
    <div className="space-y-6">
      {chairsideDialog}
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
          {canOpenClinical ? (
            <Button variant="outline" asChild>
              <Link href="/clinical/emergency">
                <AlertCircle className="mr-2 h-4 w-4" />
                Emergency
                {emergencyWaiting > 0 && (
                  <Badge className="ml-2 bg-yellow-500 text-white">{emergencyWaiting}</Badge>
                )}
                {emergencyImmediate > 0 && (
                  <Badge className="ml-1 animate-pulse bg-red-600 text-white">
                    {emergencyImmediate} urgent
                  </Badge>
                )}
              </Link>
            </Button>
          ) : null}
          {canUpdateAppointment ? (
            <Button asChild>
              <Link href="/appointments/book">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Book
              </Link>
            </Button>
          ) : null}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Week view</CardTitle>
              <Input
                placeholder="Search patient, title, doctor, chair, ref…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {searchOutsideLoadedWeek ? (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"
                role="status"
              >
                Search only applies to the loaded week —{" "}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => setSearchQuery("")}
                >
                  clear search
                </button>{" "}
                or{" "}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => router.refresh()}
                >
                  refresh
                </button>{" "}
                to search a different range.
              </div>
            ) : null}
            <div className="h-[70vh]">
              <BigCalendar
                localizer={localizer}
                events={events}
                date={calendarDate}
                onNavigate={(date) => setCalendarDate(date)}
                startAccessor={(event) => (event as { start: Date }).start}
                endAccessor={(event) => (event as { end: Date }).end}
                views={["week", "day", "agenda"]}
                defaultView="week"
                selectable
                resizable
                onEventDrop={({ event, start, end }) => {
                  const apt = (event as { resource?: AppointmentWithRelations }).resource;
                  if (!apt || !start || !end) return;
                  void rescheduleAppointment(apt.id, new Date(start), new Date(end));
                }}
                onEventResize={({ event, start, end }) => {
                  const apt = (event as { resource?: AppointmentWithRelations }).resource;
                  if (!apt || !start || !end) return;
                  void rescheduleAppointment(apt.id, new Date(start), new Date(end));
                }}
                eventPropGetter={(event) => {
                  const apt = (event as { resource?: AppointmentWithRelations }).resource;
                  if (apt?.isBlock) {
                    return {
                      style: {
                        backgroundColor: "#6b7280",
                        borderColor: "#4b5563",
                        color: "#f9fafb",
                        opacity: 0.92,
                      },
                    };
                  }
                  return {};
                }}
                onSelectSlot={(slot: SlotInfo) => {
                  if (!slot.start || !slot.end) return;
                  setSlotStart(new Date(slot.start));
                  setSlotEnd(new Date(slot.end));
                  setSlotMenuOpen(true);
                }}
                onSelectEvent={(evt) => {
                  const apt = (evt as { resource?: AppointmentWithRelations }).resource;
                  if (!apt) return;
                  setSelectedAppointmentId(apt.id);
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
              const readiness = chairReadiness[chair.id];
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      {active ? (
                        <Badge variant="warning">{active.status.replace("_", " ")}</Badge>
                      ) : (
                        <Badge variant="success">Available</Badge>
                      )}
                      {readiness?.readyAt ? (
                        <Badge variant="success">✓ Prepped</Badge>
                      ) : readiness && readiness.total > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Prep: {readiness.checked}/{readiness.total}
                        </span>
                      ) : null}
                    </div>

                    <div className="pt-2 space-y-2">
                      {liveAppointments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Drop an appointment here
                        </p>
                      ) : (
                        liveAppointments.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setSelectedAppointmentId(a.id)}
                            className="w-full rounded-md border bg-muted/30 p-2 text-left text-xs hover:bg-muted/50"
                          >
                            <div className="font-medium inline-flex items-center gap-1.5">
                              {a.isBlock
                                ? `Blocked: ${a.title}`
                                : `${a.patient?.firstName ?? ""} ${a.patient?.lastName ?? ""}`}
                              {!a.isBlock && a.patient && (
                                <InsuranceStatusBadge
                                  status={insuranceStatusMap[a.patient.id]}
                                  compact
                                />
                              )}
                            </div>
                            <div className="text-muted-foreground">
                              {format(new Date(a.startTime), "h:mm a")} — {a.title}
                            </div>
                          </button>
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
              {appointments
                .filter((apt) => !apt.isBlock && isVisibleOnCalendar(apt.status))
                .map((apt) => (
                <div
                  key={apt.id}
                  draggable
                  onClick={() => setSelectedAppointmentId(apt.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", apt.id);
                    setDraggingId(apt.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className="cursor-grab rounded-lg border bg-card p-3 active:cursor-grabbing"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium inline-flex items-center gap-1.5">
                        {apt.patient!.firstName} {apt.patient!.lastName}
                        <InsuranceStatusBadge
                          status={insuranceStatusMap[apt.patient!.id]}
                          compact
                        />
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
              {appointments.filter((apt) => !apt.isBlock).length === 0 && (
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
          {displayedAppointments.map((apt) => (
            <Card
              key={apt.id}
              className={`cursor-pointer hover:bg-muted/30 ${apt.isBlock ? "border-dashed border-muted-foreground/40 bg-muted/20" : ""}`}
              onClick={() => setSelectedAppointmentId(apt.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium inline-flex items-center gap-1.5">
                    {apt.isBlock
                      ? `Blocked: ${apt.title}`
                      : `${apt.patient?.firstName ?? ""} ${apt.patient?.lastName ?? ""}`}
                    {!apt.isBlock && apt.patient && (
                      <InsuranceStatusBadge
                        status={insuranceStatusMap[apt.patient.id]}
                        compact
                      />
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(apt.startTime), "EEE, MMM d · h:mm a")} — {apt.title}
                  </p>
                  {!apt.isBlock && apt.noShowRisk && (
                    <Badge variant="warning" className="mt-1">
                      No-show risk: {apt.noShowRisk}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Badge variant={apt.isBlock ? "secondary" : (statusVariant[apt.status] ?? "secondary")}>
                    {apt.isBlock ? "Blocked" : (statusLabel[apt.status] ?? apt.status.replace("_", " "))}
                  </Badge>
                  {apt.status !== "CANCELED" && apt.status !== "NO_SHOW" && apt.status !== "INVOICED" &&
                    renderStatusActions(apt)}
                </div>
              </CardContent>
            </Card>
          ))}
          {displayedAppointments.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery.trim() ? "No matching appointments this week" : "No appointments this week"}
            </p>
          )}
        </div>
      </div>

      <AppointmentDrawer
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
        staffRole={staffRole}
        clinicTimezone={resolvedTimezone}
      />

      <SlotActionMenu
        open={slotMenuOpen}
        onOpenChange={setSlotMenuOpen}
        slotStart={slotStart}
        slotEnd={slotEnd}
        onBlockTime={() => setBlockTimeOpen(true)}
      />

      <BlockTimeDialog
        open={blockTimeOpen}
        onOpenChange={setBlockTimeOpen}
        doctors={doctors}
        chairs={chairs}
        defaultStart={slotStart}
        defaultEnd={slotEnd}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
