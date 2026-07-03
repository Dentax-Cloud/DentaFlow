import type { PreAuthorization, TreatmentEstimate } from "@prisma/client";
import { serializeDecimal } from "@/lib/utils/serialize";
import type {
  ProcedureCodeSnapshot,
  SerializedPreAuthorization,
  SerializedTreatmentEstimate,
} from "./estimate-types";

export function serializeTreatmentEstimate(
  estimate: TreatmentEstimate,
): SerializedTreatmentEstimate {
  const s = serializeDecimal(estimate);
  return {
    id: estimate.id,
    tenantId: estimate.tenantId,
    patientId: estimate.patientId,
    treatmentPlanId: estimate.treatmentPlanId,
    policyId: estimate.policyId,
    procedureCodes: (estimate.procedureCodes as ProcedureCodeSnapshot[]) ?? [],
    totalAmount: Number(s.totalAmount ?? 0),
    estimatedInsurerAmount: Number(s.estimatedInsurerAmount ?? 0),
    estimatedPatientAmount: Number(s.estimatedPatientAmount ?? 0),
    generatedAt: estimate.generatedAt.toISOString(),
    generatedBy: estimate.generatedBy,
    pdfUrl: estimate.pdfUrl,
  };
}

export function serializePreAuthorization(
  preAuth: PreAuthorization,
): SerializedPreAuthorization {
  const s = serializeDecimal(preAuth);
  return {
    id: preAuth.id,
    tenantId: preAuth.tenantId,
    estimateId: preAuth.estimateId,
    policyId: preAuth.policyId,
    status: preAuth.status,
    referenceNumber: preAuth.referenceNumber,
    submittedAt: preAuth.submittedAt?.toISOString() ?? null,
    decisionAt: preAuth.decisionAt?.toISOString() ?? null,
    approvedInsurerAmount:
      s.approvedInsurerAmount != null ? Number(s.approvedInsurerAmount) : null,
    approvedPatientAmount:
      s.approvedPatientAmount != null ? Number(s.approvedPatientAmount) : null,
    denialReason: preAuth.denialReason,
    expiresAt: preAuth.expiresAt?.toISOString() ?? null,
    notes: preAuth.notes,
    createdBy: preAuth.createdBy,
    createdAt: preAuth.createdAt.toISOString(),
    updatedAt: preAuth.updatedAt.toISOString(),
  };
}
