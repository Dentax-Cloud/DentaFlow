export type ExamGateEncounter = {
  examCompletedAt: Date | string | null;
  examinedByStaffId: string | null;
};

/** Examination must be documented before entering the existing gate workflow. */
export function assertExamCompleteForGatesTransition(encounter: ExamGateEncounter): void {
  if (!encounter.examCompletedAt || !encounter.examinedByStaffId) {
    throw new Error("Complete the chief complaint / exam before moving to gates.");
  }
}
