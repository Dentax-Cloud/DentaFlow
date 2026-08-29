import { GateAssertionError } from "@/lib/encounter/errors";
import { examToGatesBlocker } from "@/lib/encounter/stage-transition-blockers";

export type ExamGateEncounter = {
  examCompletedAt: Date | string | null;
  examinedByStaffId: string | null;
};

/** Examination must be documented before entering the existing gate workflow. */
export function assertExamCompleteForGatesTransition(encounter: ExamGateEncounter): void {
  const blocker = examToGatesBlocker(encounter);
  if (blocker) throw new GateAssertionError(blocker);
}
