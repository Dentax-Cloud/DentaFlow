const ACTIVE_PLAN_STATUSES = new Set(["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS"]);

export type TreatmentPlanItemSnapshot = {
  status: string;
  linkedAppointmentId: string | null;
};

export type TreatmentPlanSnapshot = {
  id: string;
  title: string;
  status: string;
  items: TreatmentPlanItemSnapshot[];
};

function isTreatmentItemComplete(status: string): boolean {
  return status === "completed" || status === "COMPLETED";
}

/** Pure helper — outstanding items not yet linked to any appointment. */
export function countOutstandingUnscheduledTreatmentItems(
  plans: TreatmentPlanSnapshot[],
): number {
  return plans
    .filter((plan) => ACTIVE_PLAN_STATUSES.has(plan.status))
    .flatMap((plan) => plan.items)
    .filter((item) => !isTreatmentItemComplete(item.status) && !item.linkedAppointmentId)
    .length;
}

export function buildTreatmentPlanBookingSuggestionBody(params: {
  patientName: string;
  outstandingCount: number;
}): string {
  const noun = params.outstandingCount === 1 ? "item" : "items";
  return `${params.patientName} has an active treatment plan with ${params.outstandingCount} outstanding ${noun} — consider booking their next visit.`;
}

export function treatmentPlanBookingLink(patientId: string): string {
  return `/appointments/book?patientId=${patientId}`;
}
