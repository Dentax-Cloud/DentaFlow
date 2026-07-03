import type { AppointmentStatus } from "@prisma/client";

export function chairsideBypassOutcomeMessage(status: AppointmentStatus): string {
  if (status === "COMPLETED" || status === "INVOICED") {
    return "finalize the session and generate an invoice";
  }
  return "mark the session abandoned (recorded procedures will remain for audit)";
}
