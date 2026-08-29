import { GateAssertionError } from "@/lib/encounter/errors";
import type { EncounterStatus, GateSummary } from "@/lib/encounter/types";

export const GATE_FULL_LABELS = {
  risk: "Risk",
  consent: "Consent",
  insurance: "Insurance",
  sterilization: "Sterilization",
} as const;

const PROCEDURE_START_GATE_KEYS = ["risk", "consent", "insurance"] as const;

export type NamedGateBlocker = {
  key: (typeof PROCEDURE_START_GATE_KEYS)[number];
  label: string;
  status: GateSummary["risk"];
};

export function encounterStatusDisplayName(status: EncounterStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCollapsedGateSummary(
  gates: GateSummary,
  opts?: { insuranceOverridden?: boolean },
): string {
  const insurance = opts?.insuranceOverridden ? "overridden" : gates.insurance;
  return [
    `${GATE_FULL_LABELS.risk} ${gates.risk}`,
    `${GATE_FULL_LABELS.consent} ${gates.consent}`,
    `${GATE_FULL_LABELS.insurance} ${insurance}`,
    `${GATE_FULL_LABELS.sterilization} ${gates.sterilization}`,
  ].join(" · ");
}

export function procedureStartGateBlockers(gates: GateSummary): NamedGateBlocker[] {
  return PROCEDURE_START_GATE_KEYS.filter((key) => gates[key] !== "cleared").map(
    (key) => ({
      key,
      label: GATE_FULL_LABELS[key],
      status: gates[key],
    }),
  );
}

export function formatBlockedStageTransition(
  toLabel: string,
  blockers: Array<{ label: string; status: string }>,
): string {
  if (blockers.length === 0) return "";
  if (blockers.length === 1) {
    const blocker = blockers[0]!;
    return `Can't move to ${toLabel} yet: ${blocker.label} is still ${blocker.status}`;
  }
  const names = blockers.map((blocker) => blocker.label);
  if (names.length === 2) {
    return `Can't move to ${toLabel} yet: ${names[0]} and ${names[1]} are still blocked`;
  }
  const last = names[names.length - 1];
  return `Can't move to ${toLabel} yet: ${names.slice(0, -1).join(", ")}, and ${last} are still blocked`;
}

export function examToGatesBlocker(encounter: {
  examCompletedAt: Date | string | null;
  examinedByStaffId: string | null;
}): string | null {
  if (!encounter.examCompletedAt || !encounter.examinedByStaffId) {
    return "Can't move to Gates yet: Exam is still incomplete";
  }
  return null;
}

export function assertProcedureStartGatesFromSummary(gates: GateSummary): void {
  const blockers = procedureStartGateBlockers(gates);
  if (blockers.length === 0) return;
  throw new GateAssertionError(
    formatBlockedStageTransition(
      encounterStatusDisplayName("procedure_execution"),
      blockers,
    ),
  );
}

/** Client STATUS buttons — same gate/exam data the Gate summary already has. */
export function spineForwardTransitionBlocker(input: {
  toStatus: EncounterStatus;
  examCompletedAt: Date | string | null;
  examinedByStaffId: string | null;
  gates: GateSummary;
}): string | null {
  if (input.toStatus === "gates") {
    return examToGatesBlocker({
      examCompletedAt: input.examCompletedAt,
      examinedByStaffId: input.examinedByStaffId,
    });
  }
  if (input.toStatus === "procedure_execution") {
    const blockers = procedureStartGateBlockers(input.gates);
    if (blockers.length === 0) return null;
    return formatBlockedStageTransition(
      encounterStatusDisplayName("procedure_execution"),
      blockers,
    );
  }
  return null;
}
