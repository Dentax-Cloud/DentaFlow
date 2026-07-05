import type { Claim, ClaimStatus, Patient, PatientInsurancePolicy } from "@prisma/client";
import {
  claimKanbanColumn,
  parseProcedureSnapshot,
  type ClaimProcedureSnapshotLine,
} from "@/lib/insurance/claim-types";

export type SerializedClaim = {
  id: string;
  tenantId: string;
  policyId: string;
  invoiceId: string;
  appealedClaimId: string | null;
  claimNumber: string | null;
  submittedAmount: number;
  approvedAmount: number | null;
  paidAmount: number | null;
  paymentVariance: number | null;
  status: ClaimStatus;
  claimFormat: string;
  procedureSnapshot: ClaimProcedureSnapshotLine[];
  submittedAt: string | null;
  decisionAt: string | null;
  denialReason: string | null;
  denialCategory: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  kanbanColumn: string;
  daysSinceSubmission: number | null;
  patient?: { id: string; firstName: string; lastName: string; patientId: string | null };
  policy?: {
    id: string;
    memberId: string;
    providerName: string | null;
    networkTier: string | null;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    insuranceAmount: number;
    patientAmount: number | null;
    total: number;
  };
  appealedClaim?: { id: string; claimNumber: string | null; status: ClaimStatus };
  appeals?: Array<{ id: string; claimNumber: string | null; status: ClaimStatus }>;
};

type ClaimWithRelations = Claim & {
  policy?: (PatientInsurancePolicy & { provider?: { name: string } | null }) | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    insuranceAmount: unknown;
    patientAmount: unknown;
    total: unknown;
    patient?: Pick<Patient, "id" | "firstName" | "lastName" | "patientId"> | null;
  } | null;
  appealedClaim?: Pick<Claim, "id" | "claimNumber" | "status"> | null;
  appeals?: Array<Pick<Claim, "id" | "claimNumber" | "status">>;
};

export function serializeClaim(claim: ClaimWithRelations): SerializedClaim {
  const submittedAt = claim.submittedAt?.toISOString() ?? null;
  let daysSinceSubmission: number | null = null;
  if (submittedAt) {
    const ms = Date.now() - new Date(submittedAt).getTime();
    daysSinceSubmission = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  }

  return {
    id: claim.id,
    tenantId: claim.tenantId,
    policyId: claim.policyId,
    invoiceId: claim.invoiceId,
    appealedClaimId: claim.appealedClaimId,
    claimNumber: claim.claimNumber,
    submittedAmount: Number(claim.submittedAmount),
    approvedAmount: claim.approvedAmount != null ? Number(claim.approvedAmount) : null,
    paidAmount: claim.paidAmount != null ? Number(claim.paidAmount) : null,
    paymentVariance:
      claim.paymentVariance != null ? Number(claim.paymentVariance) : null,
    status: claim.status,
    claimFormat: claim.claimFormat,
    procedureSnapshot: parseProcedureSnapshot(claim.procedureSnapshot),
    submittedAt,
    decisionAt: claim.decisionAt?.toISOString() ?? null,
    denialReason: claim.denialReason,
    denialCategory: claim.denialCategory,
    notes: claim.notes,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    kanbanColumn: claimKanbanColumn(claim.status),
    daysSinceSubmission,
    patient: claim.invoice?.patient
      ? {
          id: claim.invoice.patient.id,
          firstName: claim.invoice.patient.firstName,
          lastName: claim.invoice.patient.lastName,
          patientId: claim.invoice.patient.patientId,
        }
      : undefined,
    policy: claim.policy
      ? {
          id: claim.policy.id,
          memberId: claim.policy.memberId,
          providerName:
            claim.policy.provider?.name ??
            claim.policy.providerNameFreeText ??
            null,
          networkTier: claim.policy.networkTier,
        }
      : undefined,
    invoice: claim.invoice
      ? {
          id: claim.invoice.id,
          invoiceNumber: claim.invoice.invoiceNumber,
          insuranceAmount: Number(claim.invoice.insuranceAmount ?? 0),
          patientAmount:
            claim.invoice.patientAmount != null
              ? Number(claim.invoice.patientAmount)
              : null,
          total: Number(claim.invoice.total),
        }
      : undefined,
    appealedClaim: claim.appealedClaim ?? undefined,
    appeals: claim.appeals,
  };
}
