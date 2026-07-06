"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Phone, User, Calendar, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { AppointmentStatus, type UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateAppointmentStatus } from "@/app/(dashboard)/features/appointments/actions";
import { beginChairsideVisit } from "@/app/(dashboard)/features/clinical/chairside-actions";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { useChairsideAppointmentConfirm } from "@/components/clinical/chairside-appointment-confirm";
import {
  formatClinicDate,
  formatClinicTime,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";

type AppointmentDetail = {
  id: string;
  appointmentRef: string | null;
  status: string;
  isBlock?: boolean;
  title?: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  type: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientId: string | null;
    patientNumber: string;
    phone: string | null;
    email: string | null;
    bloodGroup: string | null;
    allergies: string[];
    insuranceProvider: string | null;
    insuranceNetwork: string | null;
    insuranceCoPayPercent: number | null;
  } | null;
  doctor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  } | null;
  chair: { id: string; name: string } | null;
  branch: { name: string } | null;
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    next: AppointmentStatus | null;
    nextLabel: string | null;
    icon: string;
  }
> = {
  SCHEDULED: {
    label: "Scheduled",
    color: "bg-gray-100 text-gray-700",
    next: "CONFIRMED",
    nextLabel: "Confirm appointment",
    icon: "📋",
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-700",
    next: "ARRIVED",
    nextLabel: "Check in patient",
    icon: "✅",
  },
  ARRIVED: {
    label: "Arrived",
    color: "bg-yellow-100 text-yellow-700",
    next: "IN_CHAIR",
    nextLabel: "Mark as In Chair",
    icon: "🔔",
  },
  IN_CHAIR: {
    label: "In Chair",
    color: "bg-purple-100 text-purple-700",
    next: "COMPLETED",
    nextLabel: "Complete",
    icon: "🪑",
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    next: null,
    nextLabel: null,
    icon: "✓",
  },
  INVOICED: {
    label: "Invoiced",
    color: "bg-emerald-100 text-emerald-700",
    next: null,
    nextLabel: null,
    icon: "🧾",
  },
  CANCELED: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700",
    next: null,
    nextLabel: null,
    icon: "✕",
  },
  NO_SHOW: {
    label: "No Show",
    color: "bg-orange-100 text-orange-700",
    next: null,
    nextLabel: null,
    icon: "⚠",
  },
};

const TIMELINE_STATUSES = ["SCHEDULED", "CONFIRMED", "ARRIVED", "IN_CHAIR", "COMPLETED"];

export function AppointmentDrawer({
  appointmentId,
  onClose,
  staffRole,
  clinicTimezone,
}: {
  appointmentId: string | null;
  onClose: () => void;
  staffRole?: UserRole;
  clinicTimezone: string;
}) {
  const resolvedTimezone = resolveClinicTimezone(clinicTimezone);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const { confirmBeforeStatusChange, dialog: chairsideDialog } = useChairsideAppointmentConfirm();

  useEffect(() => {
    if (!appointmentId) {
      setAppointment(null);
      return;
    }

    setLoading(true);
    fetch(`/api/appointments/${appointmentId}`)
      .then((r) => r.json())
      .then((data: { appointment?: AppointmentDetail }) => setAppointment(data.appointment ?? null))
      .catch(() => setAppointment(null))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  if (!appointmentId) return null;

  const statusCfg = appointment
    ? (STATUS_CONFIG[appointment.status] ?? STATUS_CONFIG.SCHEDULED)
    : null;

  async function refreshAppointment(id: string) {
    const res = await fetch(`/api/appointments/${id}`);
    const data = (await res.json()) as { appointment?: AppointmentDetail };
    setAppointment(data.appointment ?? null);
  }

  const canStartChairside = staffRole
    ? hasPermission(staffRole, PERMISSIONS.clinical_chart.write)
    : false;
  const canMarkInChair = staffRole
    ? hasPermission(staffRole, PERMISSIONS.appointments.write)
    : false;

  async function handleBeginChairside() {
    if (!appointment || appointment.isBlock || !appointment.patient) return;
    startTransition(async () => {
      try {
        const result = await beginChairsideVisit({
          patientId: appointment.patient!.id,
          appointmentId: appointment.id,
        });
        await refreshAppointment(appointment.id);
        router.push(
          `/clinical/chairside?patientId=${result.patientId}&appointmentId=${result.appointmentId}&sessionId=${result.sessionId}`,
        );
        onClose();
        router.refresh();
      } catch {
        // Permission or network errors surface from the server action
      }
    });
  }

  function executeStatusChange(newStatus: AppointmentStatus) {
    if (!appointment) return;
    startTransition(async () => {
      const result = await updateAppointmentStatus({
        id: appointment.id,
        status: newStatus,
      });
      if (result.success) {
        await refreshAppointment(appointment.id);
        router.refresh();
      }
    });
  }

  function handleStatusChange(newStatus: AppointmentStatus) {
    if (!appointment) return;
    void confirmBeforeStatusChange(appointment.id, newStatus, () =>
      executeStatusChange(newStatus),
    );
  }

  function handleCancel() {
    if (!appointment) return;
    const label = appointment.isBlock
      ? "Remove this blocked time?"
      : "Cancel this appointment? This cannot be undone.";
    const run = () => {
      if (!confirm(label)) return;
      executeStatusChange("CANCELED");
    };
    if (appointment.isBlock) {
      run();
      return;
    }
    void confirmBeforeStatusChange(appointment.id, "CANCELED", run);
  }

  const showMarkInChair =
    canMarkInChair &&
    !canStartChairside &&
    appointment?.status === "ARRIVED";

  const showChairside =
    canStartChairside &&
    appointment != null &&
    !appointment.isBlock &&
    appointment.patient != null &&
    ["ARRIVED", "IN_CHAIR"].includes(appointment.status);

  const showStatusAdvance =
    !appointment?.isBlock &&
    statusCfg?.next &&
    statusCfg.nextLabel &&
    (statusCfg.next !== "IN_CHAIR" || showMarkInChair);

  return (
    <>
      {chairsideDialog}
      <button
        type="button"
        aria-label="Close drawer"
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      <div className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[480px] animate-in slide-in-from-right flex-col overflow-hidden bg-white shadow-2xl duration-200">
        <div className="flex items-center justify-between border-b bg-gray-50 px-5 py-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {appointment?.appointmentRef ?? "Loading..."}
            </p>
            {statusCfg && (
              <Badge className={`mt-1 ${statusCfg.color}`}>
                {statusCfg.icon} {statusCfg.label}
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : appointment ? (
          <div className="flex-1 overflow-y-auto">
            {appointment.isBlock ? (
              <>
                <div className="border-b px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                      <Clock className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Blocked time</p>
                      <p className="text-sm text-muted-foreground">{appointment.title}</p>
                    </div>
                  </div>
                </div>
                <div className="border-b px-5 py-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatClinicDate(new Date(appointment.startTime), resolvedTimezone)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {formatClinicTime(new Date(appointment.startTime), resolvedTimezone)}
                        {" → "}
                        {formatClinicTime(new Date(appointment.endTime), resolvedTimezone)}
                      </span>
                    </div>
                    {appointment.doctor && (
                      <div className="text-muted-foreground">
                        Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                      </div>
                    )}
                    {appointment.chair && (
                      <div className="text-muted-foreground">Chair: {appointment.chair.name}</div>
                    )}
                    {appointment.notes && (
                      <div className="mt-2 rounded border bg-muted/50 p-2 text-xs">
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                </div>
                {appointment.status !== "CANCELED" && (
                  <div className="px-5 py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isPending}
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Remove block
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
            <div className="border-b px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {appointment.patient?.firstName} {appointment.patient?.lastName}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {appointment.patient?.patientId ?? appointment.patient?.patientNumber}
                    </p>
                  </div>
                </div>
                {appointment.patient && (
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/patients/${appointment.patient!.id}`);
                    onClose();
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  360 View <ChevronRight className="h-3 w-3" />
                </button>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {appointment.patient && appointment.patient.allergies.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-xs font-medium text-red-700">
                      Allergy: {appointment.patient.allergies.join(", ")}
                    </p>
                  </div>
                )}
                {appointment.patient?.bloodGroup && (
                  <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {appointment.patient.bloodGroup}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {appointment.patient?.phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {appointment.patient.phone}
                  </div>
                )}
                {appointment.patient?.insuranceProvider && (
                  <div className="text-muted-foreground">
                    {appointment.patient.insuranceProvider}
                    {appointment.patient.insuranceNetwork &&
                      ` · ${appointment.patient.insuranceNetwork}`}
                    {appointment.patient.insuranceCoPayPercent != null &&
                      ` · ${appointment.patient.insuranceCoPayPercent}% co-pay`}
                  </div>
                )}
              </div>
            </div>

            <div className="border-b px-5 py-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatClinicDate(new Date(appointment.startTime), resolvedTimezone)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {formatClinicTime(new Date(appointment.startTime), resolvedTimezone)}
                    {" → "}
                    {formatClinicTime(new Date(appointment.endTime), resolvedTimezone)}
                  </span>
                </div>
                {appointment.doctor && (
                  <div className="text-muted-foreground">
                    Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                  </div>
                )}
                {appointment.chair && (
                  <div className="text-muted-foreground">Chair: {appointment.chair.name}</div>
                )}
                {appointment.branch && (
                  <div className="text-muted-foreground">Branch: {appointment.branch.name}</div>
                )}
                {appointment.notes && (
                  <div className="mt-2 rounded border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800">
                    {appointment.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="border-b px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status Timeline
              </p>
              <div className="space-y-2">
                {TIMELINE_STATUSES.map((status) => {
                  const cfg = STATUS_CONFIG[status];
                  const currentIdx = TIMELINE_STATUSES.indexOf(appointment.status);
                  const thisIdx = TIMELINE_STATUSES.indexOf(status);
                  const isPast = currentIdx > thisIdx;
                  const isCurrent = status === appointment.status;

                  return (
                    <div key={status} className="flex items-center gap-2 text-sm">
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : isPast
                              ? "bg-green-500 text-white"
                              : "bg-gray-200 text-gray-400"
                        }`}
                      >
                        {isPast ? "✓" : cfg.icon}
                      </div>
                      <span
                        className={
                          isCurrent
                            ? "font-semibold text-blue-700"
                            : isPast
                              ? "text-green-700"
                              : "text-muted-foreground"
                        }
                      >
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              {showStatusAdvance && (
                <Button
                  onClick={() => handleStatusChange(statusCfg!.next!)}
                  disabled={isPending}
                  variant={statusCfg!.next === "IN_CHAIR" ? "outline" : "default"}
                  className={
                    statusCfg!.next === "IN_CHAIR"
                      ? "w-full"
                      : "w-full bg-blue-600 hover:bg-blue-700"
                  }
                  size="lg"
                >
                  {isPending ? "Updating..." : statusCfg!.nextLabel}
                </Button>
              )}

              {showChairside && (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  disabled={isPending}
                  onClick={handleBeginChairside}
                >
                  {isPending ? "Starting..." : "Open Chairside Session"}
                </Button>
              )}

              {appointment.status === "COMPLETED" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    router.push(`/billing?appointmentId=${appointment.id}`);
                    onClose();
                  }}
                >
                  Generate Invoice
                </Button>
              )}

              {!["COMPLETED", "CANCELED", "NO_SHOW", "INVOICED"].includes(
                appointment.status,
              ) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                >
                  Cancel appointment
                </Button>
              )}
            </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <p>Appointment not found</p>
          </div>
        )}
      </div>
    </>
  );
}
