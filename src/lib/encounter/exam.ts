import { GateAssertionError } from "@/lib/encounter/errors";
import { examToGatesBlocker } from "@/lib/encounter/stage-transition-blockers";

export type ExamGateEncounter = {
  examCompletedAt: Date | string | null;
  examinedByStaffId: string | null;
};

export type ExamDocumentationInput = {
  chiefComplaint: string;
  findings: string;
  provisionalDiagnosis: string;
};

const EXAM_FIELD_LABELS = [
  { key: "chiefComplaint", label: "Chief complaint" },
  { key: "findings", label: "Findings" },
  { key: "provisionalDiagnosis", label: "Provisional diagnosis" },
] as const;

/** Examination must be documented before entering the existing gate workflow. */
export function assertExamCompleteForGatesTransition(encounter: ExamGateEncounter): void {
  const blocker = examToGatesBlocker(encounter);
  if (blocker) throw new GateAssertionError(blocker);
}

export function missingExamDocumentationLabels(input: ExamDocumentationInput): string[] {
  return EXAM_FIELD_LABELS.filter(({ key }) => !input[key].trim()).map(({ label }) => label);
}

export function formatMissingExamDocumentation(missing: string[]): string {
  if (missing.length === 1) {
    return `${missing[0]} is required to complete the exam.`;
  }
  if (missing.length === 2) {
    return `${missing[0]} and ${missing[1]} are required to complete the exam.`;
  }
  return "Chief complaint, Findings, and Provisional diagnosis are required to complete the exam.";
}

/** Chief complaint, findings, and provisional diagnosis are required product fields. */
export function assertExamDocumentationComplete(input: ExamDocumentationInput): {
  chiefComplaint: string;
  findings: string;
  provisionalDiagnosis: string;
} {
  const chiefComplaint = input.chiefComplaint.trim();
  const findings = input.findings.trim();
  const provisionalDiagnosis = input.provisionalDiagnosis.trim();
  const missing = missingExamDocumentationLabels({
    chiefComplaint,
    findings,
    provisionalDiagnosis,
  });
  if (missing.length > 0) {
    throw new GateAssertionError(formatMissingExamDocumentation(missing));
  }
  return { chiefComplaint, findings, provisionalDiagnosis };
}
