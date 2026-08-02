/** Lowercase encounter status values stored in DB; render UPPERCASE in UI. */
export const ENCOUNTER_STATUSES = [
  "arrival_intake",
  "chief_complaint_exam",
  "gates",
  "procedure_execution",
  "close_out",
  "billing",
  "recall_scheduled",
  "interrupted",
] as const;

export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

/** Assistance presence is recorded without extending the encounter status enum. */
export const NURSE_PRESENCE_STAGES = [
  "tray_setup",
  "chairside_assist",
  "turnover",
] as const;

export type NursePresenceStage = (typeof NURSE_PRESENCE_STAGES)[number];

export function isNursePresenceStage(stage: string): stage is NursePresenceStage {
  return (NURSE_PRESENCE_STAGES as readonly string[]).includes(stage);
}

export const PROCEDURE_LINE_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "declined",
  "interrupted",
] as const;

export type EncounterProcedureLineStatus = (typeof PROCEDURE_LINE_STATUSES)[number];

export const PLANNED_VS_PERFORMED = [
  "matched",
  "added",
  "modified",
  "declined",
] as const;

export type PlannedVsPerformed = (typeof PLANNED_VS_PERFORMED)[number];

export type CompatProcedureLine = {
  id: string;
  tenantId: string;
  encounterId: string;
  treatmentItemId: string | null;
  procedureBundleId: string | null;
  procedureCatalogId: string | null;
  procedureCode: string | null;
  procedureName: string | null;
  toothNumbers: string[];
  surfaces: string[];
  status: EncounterProcedureLineStatus;
  plannedVsPerformed: PlannedVsPerformed;
  providerId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  source: "encounter" | "chairside_entry" | "visit_procedure_line";
};

export type CompatEncounter = {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId: string;
  treatmentPlanId: string | null;
  status: EncounterStatus;
  interruptOutcome: string | null;
  startedAt: string;
  closedAt: string | null;
  source: "encounter" | "compat";
  procedureLines: CompatProcedureLine[];
};

export type TimelineEventKind =
  | "intake"
  | "gate_summary"
  | "procedure"
  | "handoff"
  | "interrupt"
  | "material"
  | "image";

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  at: string;
  title: string;
  detail?: string;
  status?: string;
};

export type GateSummary = {
  risk: "cleared" | "pending" | "blocked" | "unknown";
  consent: "cleared" | "pending" | "blocked" | "unknown";
  insurance: "cleared" | "pending" | "blocked" | "unknown";
  sterilization: "cleared" | "pending" | "blocked" | "unknown";
};
