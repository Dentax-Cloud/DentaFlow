import type { AppointmentStatus } from "@prisma/client";

/** Shared appointment status palette — calendar, dashboard charts, badges. */
export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#9ca3af",
  CONFIRMED: "#3b82f6",
  ARRIVED: "#eab308",
  IN_CHAIR: "#a855f7",
  COMPLETED: "#22c55e",
  INVOICED: "#10b981",
  CANCELED: "#ef4444",
  NO_SHOW: "#f97316",
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  ARRIVED: "Checked in",
  IN_CHAIR: "In chair",
  COMPLETED: "Completed",
  INVOICED: "Invoiced",
  CANCELED: "Canceled",
  NO_SHOW: "No show",
};

/** Dashboard donut groups (today's pipeline). */
export const DASHBOARD_STATUS_GROUPS = [
  { key: "scheduled", label: "Scheduled", statuses: ["SCHEDULED", "CONFIRMED"] as AppointmentStatus[] },
  { key: "arrived", label: "Checked in", statuses: ["ARRIVED"] as AppointmentStatus[] },
  { key: "in_chair", label: "In chair", statuses: ["IN_CHAIR"] as AppointmentStatus[] },
  { key: "completed", label: "Completed", statuses: ["COMPLETED", "INVOICED"] as AppointmentStatus[] },
  { key: "no_show", label: "No show", statuses: ["NO_SHOW"] as AppointmentStatus[] },
] as const;

export function getAppointmentStatusColor(status: string): string {
  return APPOINTMENT_STATUS_COLORS[status] ?? "#94a3b8";
}

export function getAppointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function getDashboardGroupColor(groupKey: string): string {
  switch (groupKey) {
    case "scheduled":
      return APPOINTMENT_STATUS_COLORS.CONFIRMED;
    case "arrived":
      return APPOINTMENT_STATUS_COLORS.ARRIVED;
    case "in_chair":
      return APPOINTMENT_STATUS_COLORS.IN_CHAIR;
    case "completed":
      return APPOINTMENT_STATUS_COLORS.COMPLETED;
    case "no_show":
      return APPOINTMENT_STATUS_COLORS.NO_SHOW;
    default:
      return "#94a3b8";
  }
}
