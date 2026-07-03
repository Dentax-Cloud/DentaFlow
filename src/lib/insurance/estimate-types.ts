import type { PreAuthStatus } from "@prisma/client";

export type ProcedureCodeSnapshot = {
  code: string;
  description: string;
  amount: number;
};

export type SerializedTreatmentEstimate = {
  id: string;
  tenantId: string;
  patientId: string;
  treatmentPlanId: string | null;
  policyId: string | null;
  procedureCodes: ProcedureCodeSnapshot[];
  totalAmount: number;
  estimatedInsurerAmount: number;
  estimatedPatientAmount: number;
  generatedAt: string;
  generatedBy: string;
  pdfUrl: string | null;
};

export type SerializedPreAuthorization = {
  id: string;
  tenantId: string;
  estimateId: string | null;
  policyId: string;
  status: PreAuthStatus;
  referenceNumber: string | null;
  submittedAt: string | null;
  decisionAt: string | null;
  approvedInsurerAmount: number | null;
  approvedPatientAmount: number | null;
  denialReason: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const APPROVED_PRE_AUTH_STATUSES: PreAuthStatus[] = ["APPROVED", "PARTIALLY_APPROVED"];

export function isPreAuthApproved(status: PreAuthStatus): boolean {
  return APPROVED_PRE_AUTH_STATUSES.includes(status);
}
