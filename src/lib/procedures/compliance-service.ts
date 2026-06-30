// ============================================================
// Clinical Compliance Record Service
// Auto-generates audit records when procedures are completed
// Creates tamper-evident SHA-256 hash for each record
// ============================================================

import { db } from "@/lib/db"
import { createHash } from "crypto"
import { randomUUID } from "crypto"
import { resolveProcedure } from "./procedure-resolver"

// ── Types ─────────────────────────────────────────────────────

export type ComplianceChecklist = {
  medicalHistoryReviewed: boolean
  consentObtained:        boolean
  xrayReviewed:           boolean
  preAuthObtained:        boolean
  insuranceVerified:      boolean
  postOpInstructionsGiven:boolean
  [key: string]: boolean
}

export type CreateComplianceInput = {
  tenantId:       string
  patientId:      string
  appointmentId?: string
  procedureId:    string
  performedById:  string
  toothNumbers?:  string[]
  surfaces?:      string[]
  billedAmount?:  number | null
  insurerAmount?: number | null
  patientAmount?: number | null
  preAuthCode?:   string | null
  claimCode?:     string | null
  checklist?:     Partial<ComplianceChecklist>
}

export type ComplianceRecordSummary = {
  id:            string
  procedureCode: string | null
  localCode:     string | null
  performedAt:   Date
  billedAmount:  number | null
  claimSubmitted:boolean
  auditHash:     string | null
  complianceStd: string | null
  retentionUntil:Date | null
  checklist:     ComplianceChecklist
}

// ── Create compliance record ──────────────────────────────────

export async function createComplianceRecord(
  input: CreateComplianceInput
): Promise<string> {
  // Resolve procedure to get country codes and compliance rules
  const resolved = await resolveProcedure(
    input.procedureId,
    input.tenantId
  )

  // Get performer details
  const performer = await db.staffMember.findUnique({
    where: { id: input.performedById },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      doctor: { select: { licenseNo: true } },
    },
  }).catch(() => null);

  const licenseNumber = performer?.doctor?.licenseNo ?? null;

  // Get tenant settings
  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    select: {
      countryCode:         true,
      currency:            true,
      patientRetentionYrs: true,
    },
  })

  const countryCode    = tenant?.countryCode    ?? "AE"
  const currency       = tenant?.currency       ?? "AED"
  const retentionYears = tenant?.patientRetentionYrs ?? 10

  // Calculate retention date
  const retentionUntil = new Date()
  retentionUntil.setFullYear(
    retentionUntil.getFullYear() + retentionYears
  )

  // Build complete checklist
  const checklist: ComplianceChecklist = {
    medicalHistoryReviewed:  true,
    consentObtained:
      input.checklist?.consentObtained ??
      !resolved?.requiresConsent,
    xrayReviewed:
      input.checklist?.xrayReviewed ??
      !resolved?.requiresXray,
    preAuthObtained:
      input.checklist?.preAuthObtained ??
      !!input.preAuthCode,
    insuranceVerified:
      input.checklist?.insuranceVerified ?? false,
    postOpInstructionsGiven:
      input.checklist?.postOpInstructionsGiven ?? false,
    ...input.checklist,
  }

  const performedAt = new Date()

  // Build record data for hashing
  const recordForHash = {
    tenantId:      input.tenantId,
    patientId:     input.patientId,
    procedureId:   input.procedureId,
    procedureCode: resolved?.code ?? "",
    localCode:     resolved?.claimCode ?? input.claimCode ?? "",
    performedById: input.performedById,
    performedAt:   performedAt.toISOString(),
    toothNumbers:  input.toothNumbers ?? [],
    surfaces:      input.surfaces ?? [],
    billedAmount:  input.billedAmount ?? 0,
    checklist,
  }

  // SHA-256 hash for tamper-evidence
  const auditHash = createHash("sha256")
    .update(JSON.stringify(recordForHash))
    .digest("hex")

  // Determine compliance standard
  const complianceStd = `${countryCode}-${new Date().getFullYear()}`

  // Create the record
  const record = await db.clinicalComplianceRecord.create({
    data: {
      id:            randomUUID(),
      tenantId:      input.tenantId,
      patientId:     input.patientId,
      appointmentId: input.appointmentId ?? null,
      gpmrId:        resolved?.gpmrCode  ?? null,
      procedureCode: resolved?.code      ?? null,
      localCode:
        resolved?.claimCode ??
        input.claimCode     ??
        null,
      countryPack:   countryCode,
      performedById: input.performedById,
      licenseNumber,
      performedAt,
      toothNumbers:  input.toothNumbers ?? [],
      surfaces:      input.surfaces     ?? [],
      checklist,
      billedAmount:  input.billedAmount  ?? null,
      insurerAmount: input.insurerAmount ?? null,
      patientAmount: input.patientAmount ?? null,
      currencyCode:  currency,
      preAuthCode:   input.preAuthCode   ?? null,
      claimCode:
        resolved?.claimCode ??
        input.claimCode     ??
        null,
      claimSubmitted: false,
      auditHash,
      signedByDoctor: false,
      retentionUntil,
      complianceStd,
    },
  })

  console.log(
    `[Compliance] Record created: ${record.id} ` +
    `for procedure ${resolved?.code ?? "unknown"} ` +
    `patient ${input.patientId}`
  )

  return record.id
}

// ── Get compliance records for patient ───────────────────────

export async function getPatientComplianceRecords(
  tenantId: string,
  patientId: string,
  limit = 50
): Promise<ComplianceRecordSummary[]> {
  const records = await db.clinicalComplianceRecord.findMany({
    where: { tenantId, patientId },
    orderBy: { performedAt: "desc" },
    take: limit,
  })

  return records.map(r => ({
    id:            r.id,
    procedureCode: r.procedureCode,
    localCode:     r.localCode,
    performedAt:   r.performedAt,
    billedAmount:  r.billedAmount ? Number(r.billedAmount) : null,
    claimSubmitted:r.claimSubmitted,
    auditHash:     r.auditHash,
    complianceStd: r.complianceStd,
    retentionUntil:r.retentionUntil,
    checklist:     r.checklist as ComplianceChecklist,
  }))
}

// ── Verify record integrity ───────────────────────────────────

export async function verifyComplianceRecord(
  recordId: string,
  tenantId: string
): Promise<{
  valid:   boolean
  message: string
}> {
  const record = await db.clinicalComplianceRecord.findFirst({
    where: { id: recordId, tenantId },
  })

  if (!record) {
    return { valid: false, message: "Record not found" }
  }

  if (!record.auditHash) {
    return {
      valid:   false,
      message: "Record has no audit hash — integrity cannot be verified",
    }
  }

  // Rebuild the hash from stored data
  const recordForHash = {
    tenantId:      record.tenantId,
    patientId:     record.patientId,
    procedureId:   record.procedureCode ?? "",
    procedureCode: record.procedureCode ?? "",
    localCode:     record.localCode ?? "",
    performedById: record.performedById,
    performedAt:   record.performedAt.toISOString(),
    toothNumbers:  record.toothNumbers ?? [],
    surfaces:      record.surfaces ?? [],
    billedAmount:  record.billedAmount
      ? Number(record.billedAmount)
      : 0,
    checklist:     record.checklist,
  }

  const recomputedHash = createHash("sha256")
    .update(JSON.stringify(recordForHash))
    .digest("hex")

  if (recomputedHash === record.auditHash) {
    return {
      valid:   true,
      message: "Record integrity verified — hash matches",
    }
  }

  return {
    valid:   false,
    message:
      "INTEGRITY FAILURE — record hash does not match. " +
      "Record may have been tampered with.",
  }
}

// ── Mark claim as submitted ───────────────────────────────────

export async function markClaimSubmitted(
  recordId: string,
  tenantId: string,
  regulatoryRef?: string
): Promise<void> {
  await db.clinicalComplianceRecord.updateMany({
    where: { id: recordId, tenantId },
    data: {
      claimSubmitted: true,
      regulatoryRef:  regulatoryRef ?? null,
    },
  })
}

// ── Get compliance summary for tenant ────────────────────────

export async function getTenantComplianceSummary(
  tenantId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<{
  totalProcedures:       number
  claimsSubmitted:       number
  claimsPending:         number
  recordsNearExpiry:     number
  integrityIssues:       number
}> {
  const dateFilter = dateFrom || dateTo
    ? {
        performedAt: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo   ? { lte: dateTo   } : {}),
        },
      }
    : {}

  const [
    totalProcedures,
    claimsSubmitted,
    claimsPending,
    recordsNearExpiry,
  ] = await Promise.all([
    db.clinicalComplianceRecord.count({
      where: { tenantId, ...dateFilter },
    }),
    db.clinicalComplianceRecord.count({
      where: { tenantId, claimSubmitted: true, ...dateFilter },
    }),
    db.clinicalComplianceRecord.count({
      where: {
        tenantId,
        claimSubmitted: false,
        claimCode:      { not: null },
        ...dateFilter,
      },
    }),
    db.clinicalComplianceRecord.count({
      where: {
        tenantId,
        retentionUntil: {
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    }),
  ])

  return {
    totalProcedures,
    claimsSubmitted,
    claimsPending,
    recordsNearExpiry,
    integrityIssues: 0, // computed on demand via verifyComplianceRecord
  }
}

// ── Records expiring soon (for alerts) ───────────────────────

export async function getExpiringRecords(
  tenantId: string,
  withinDays = 90
): Promise<Array<{
  id:            string
  patientId:     string
  procedureCode: string | null
  performedAt:   Date
  retentionUntil:Date | null
}>> {
  const cutoff = new Date(
    Date.now() + withinDays * 24 * 60 * 60 * 1000
  )

  return db.clinicalComplianceRecord.findMany({
    where: {
      tenantId,
      retentionUntil: { lte: cutoff, gte: new Date() },
    },
    select: {
      id:            true,
      patientId:     true,
      procedureCode: true,
      performedAt:   true,
      retentionUntil:true,
    },
    orderBy: { retentionUntil: "asc" },
    take: 100,
  })
}