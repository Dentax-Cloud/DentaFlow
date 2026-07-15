import type { EncounterStatus } from "./types";
import { ENCOUNTER_STATUSES } from "./types";

/** Forward happy-path edges. Interrupt edges handled separately. */
export const LEGAL_FORWARD_TRANSITIONS: Record<EncounterStatus, EncounterStatus[]> = {
  arrival_intake: ["chief_complaint_exam"],
  chief_complaint_exam: ["gates"],
  gates: ["procedure_execution"],
  procedure_execution: ["close_out"],
  close_out: ["billing"],
  billing: ["recall_scheduled"],
  recall_scheduled: [],
  interrupted: [],
};

/** States that may move to `interrupted` (post-gates). */
export const INTERRUPTIBLE_STATUSES: EncounterStatus[] = [
  "procedure_execution",
  "close_out",
  "billing",
];

export const INTERRUPT_OUTCOMES = [
  "resumed",
  "abandoned_partial_bill",
  "abandoned_no_bill",
] as const;

export type InterruptOutcome = (typeof INTERRUPT_OUTCOMES)[number];

export function isEncounterStatus(value: string): value is EncounterStatus {
  return (ENCOUNTER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(
  from: EncounterStatus,
  to: EncounterStatus,
): boolean {
  if (from === to) return false;
  if (to === "interrupted") {
    return INTERRUPTIBLE_STATUSES.includes(from);
  }
  if (from === "interrupted") {
    // Resume / abandon outcomes are resolved via resolveInterrupt, not transition().
    return false;
  }
  return LEGAL_FORWARD_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: EncounterStatus, to: EncounterStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal encounter transition: ${from} → ${to}`);
  }
}

export const PROCEDURE_LINE_TERMINAL = [
  "completed",
  "declined",
  "interrupted",
] as const;

export function isProcedureLineTerminal(status: string): boolean {
  return (PROCEDURE_LINE_TERMINAL as readonly string[]).includes(status);
}

export function isProcedureLineBillable(status: string): boolean {
  return status === "completed" || status === "interrupted";
}
