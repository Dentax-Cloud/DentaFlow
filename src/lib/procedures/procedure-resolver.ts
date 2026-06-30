// ============================================================
// Procedure Resolver
// Merges GPMR + CountryPack + TenantOverride into one object
// Priority: Tenant > CountryPack > GPMR
// PRICES: Only from tenant — never from GPMR or CountryPack
// ============================================================

import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

// ── Types ─────────────────────────────────────────────────────

type WorkflowJson = Record<string, unknown> | null

type ComplianceRules = {
  consentRequired?: boolean
  xrayRequired?: boolean
}

type InsuranceCodes = {
  requiresPreAuth?: boolean
  claimCode?: string
}

type TaxRules = {
  vatApplicable?: boolean
  vatRate?: number
  gstRate?: number
  nhsBand?: number
  nhsChargePence?: number
}

type BranchPriceEntry = {
  sellingPrice?: number
}

export type ResolvedProcedure = {
  // Identity
  id:          string
  gpmrCode:    string | null
  code:        string
  name:        string
  nameAr:      string | null
  category:    string
  subCategory: string | null

  // Duration (tenant override > GPMR default)
  durationMins: number

  // Pricing — TENANT SETS ALL
  // null = not yet priced = cannot be invoiced
  sellingPrice:  number | null
  costPrice:     number | null
  branchPrice:   number | null
  isPriced:      boolean
  currency:      string

  // Clinical requirements
  toothRequired:    boolean
  surfaceRequired:  boolean
  archRequired:     boolean
  quadrantRequired: boolean
  requiredInputs:   string[]
  optionalInputs:   string[]
  prerequisites:    PrerequisiteRule[]
  contraindications: ContraindicationRule[]
  postProcedureActions: PostProcedureAction[]
  requiredAttachments: string[]
  optionalAttachments: string[]

  // Compliance (country pack + tenant override)
  requiresConsent:  boolean
  requiresXray:     boolean
  requiresPreAuth:  boolean

  // Country codes (from pack)
  localCodes:    Record<string, string>
  claimCode:     string | null
  taxApplicable: boolean
  taxRate:       number
  nhsBand:       number | null
  nhsChargePence:number | null

  // Workflow
  workflowConfig:    WorkflowJson
  workflowAdditions: Record<string, unknown>

  // Flags
  isActive:         boolean
  isOnlineBookable: boolean
  isBillable:       boolean
  canBundle:        boolean
  modules:          string[]
  aiSuggestTriggers: string[]

  // Source info
  source: {
    hasGpmr:          boolean
    hasCountryPack:   boolean
    hasTenantOverride: boolean
  }
}

export type PrerequisiteRule = {
  gpmrCode:       string
  condition:      string
  description:    string
  enforcement:    "BLOCK" | "WARN" | "INFO"
  timeframeMonths?: number
}

export type ContraindicationRule = {
  condition: string
  severity:  "BLOCK" | "WARNING" | "INFO"
  message:   string
}

export type PostProcedureAction = {
  action:   string
  required: boolean
}

export type PreClinicalCheck = {
  type:        "BLOCK" | "WARN" | "INFO"
  code:        string
  message:     string
  canOverride: boolean
}

// ── Main resolver ─────────────────────────────────────────────

export async function resolveProcedure(
  procedureCatalogId: string,
  tenantId: string,
  branchId?: string
): Promise<ResolvedProcedure | null> {
  // Fetch tenant procedure with GPMR + country packs
  const tenantProc = await db.procedureCatalog.findFirst({
    where: { id: procedureCatalogId, tenantId },
    include: {
      globalProcedure: {
        include: {
          countryPacks: {
            where: { isActive: true },
          },
        },
      },
    },
  })

  if (!tenantProc) return null

  // Fetch tenant settings
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      countryCode:    true,
      currency:       true,
      taxRate:        true,
      taxName:        true,
    },
  })

  const countryCode = tenant?.countryCode ?? "AE"
  const currency    = tenant?.currency    ?? "AED"
  const gpmr        = tenantProc.globalProcedure

  // Find matching country pack
  const countryPack = gpmr?.countryPacks.find(
    p => p.countryCode === countryCode && p.isActive
  ) ?? null

  // ── Resolve duration ────────────────────────────────────────
  // Tenant override > GPMR default > system default
  const durationMins =
    tenantProc.durationMins ??
    gpmr?.defaultDurationMins ??
    30

  // ── Resolve name ────────────────────────────────────────────
  const gpmrNames = (gpmr?.names ?? {}) as Record<string, string>
  const resolvedName =
    tenantProc.name ||
    countryPack?.localName ||
    gpmrNames[`en-${countryCode}`] ||
    gpmrNames["en"] ||
    gpmr?.canonicalName ||
    tenantProc.code

  const resolvedNameAr =
    tenantProc.nameAr ||
    countryPack?.localNameAr ||
    gpmrNames["ar"] ||
    null

  // ── Resolve branch price ────────────────────────────────────
  let branchPrice: number | null = null
  if (branchId && tenantProc.branchPrices) {
    const bp = tenantProc.branchPrices as Record<string, BranchPriceEntry>
    branchPrice = bp[branchId]?.sellingPrice ?? null
  }

  // ── Resolve selling price ───────────────────────────────────
  // CRITICAL: Prices ONLY from tenant — never from GPMR or pack
  const sellingPrice =
    branchPrice ??
    (tenantProc.sellingPrice != null
      ? Number(tenantProc.sellingPrice)
      : null)

  const costPrice =
    tenantProc.costPrice != null
      ? Number(tenantProc.costPrice)
      : null

  const isPriced = sellingPrice !== null

  // ── Resolve compliance ──────────────────────────────────────
  // Tenant override takes priority, then country pack
  const packCompliance = (countryPack?.complianceRules ?? {}) as ComplianceRules

  const requiresConsent =
    tenantProc.requiresConsent ||
    packCompliance.consentRequired === true

  const requiresXray =
    tenantProc.requiresXray ||
    packCompliance.xrayRequired === true

  const insuranceCodes = (countryPack?.insuranceCodes ?? {}) as InsuranceCodes

  const requiresPreAuth =
    tenantProc.requiresPreAuth ||
    insuranceCodes.requiresPreAuth === true

  // ── Resolve local codes ─────────────────────────────────────
  const localCodes =
    (countryPack?.localCodes ?? {}) as Record<string, string>

  const claimCode =
    insuranceCodes.claimCode ??
    localCodes.DHA ??
    localCodes.CDT ??
    localCodes.NHS ??
    localCodes.CCHI ??
    localCodes.NPHIES ??
    null

  // ── Resolve tax ─────────────────────────────────────────────
  const packTax = (countryPack?.taxRules ?? {}) as TaxRules
  const taxApplicable = packTax.vatApplicable === true
  const taxRate =
    packTax.vatRate ??
    packTax.gstRate ??
    0
  const nhsBand        = packTax.nhsBand        ?? null
  const nhsChargePence = packTax.nhsChargePence ?? null

  return {
    id:          tenantProc.id,
    gpmrCode:    gpmr?.gpmrCode ?? null,
    code:        tenantProc.code,
    name:        resolvedName,
    nameAr:      resolvedNameAr,
    category:    tenantProc.category,
    subCategory: gpmr?.subCategory ?? null,

    durationMins,

    sellingPrice,
    costPrice,
    branchPrice,
    isPriced,
    currency,

    toothRequired:    gpmr?.toothRequired    ?? false,
    surfaceRequired:  gpmr?.surfaceRequired   ?? false,
    archRequired:     gpmr?.archRequired      ?? false,
    quadrantRequired: gpmr?.quadrantRequired  ?? false,

    requiredInputs:
      (gpmr?.requiredInputs as string[]) ?? [],
    optionalInputs:
      (gpmr?.optionalInputs as string[]) ?? [],
    prerequisites:
      (gpmr?.prerequisites as PrerequisiteRule[]) ?? [],
    contraindications:
      (gpmr?.contraindications as ContraindicationRule[]) ?? [],
    postProcedureActions:
      (gpmr?.postProcedureActions as PostProcedureAction[]) ?? [],
    requiredAttachments:
      (gpmr?.requiredAttachments as string[]) ?? [],
    optionalAttachments:
      (gpmr?.optionalAttachments as string[]) ?? [],

    requiresConsent,
    requiresXray,
    requiresPreAuth,

    localCodes,
    claimCode,
    taxApplicable,
    taxRate,
    nhsBand,
    nhsChargePence,

    workflowConfig:    (tenantProc.workflowConfig as WorkflowJson) ?? null,
    workflowAdditions: (countryPack?.workflowAdditions ?? {}) as Record<string, unknown>,

    isActive:          tenantProc.isActive,
    isOnlineBookable:  tenantProc.isOnlineBookable,
    isBillable:        gpmr?.isBillable    ?? true,
    canBundle:         gpmr?.canBundle     ?? true,
    modules:           (gpmr?.modules as string[])            ?? [],
    aiSuggestTriggers: (gpmr?.aiSuggestTriggers as string[]) ?? [],

    source: {
      hasGpmr:           !!gpmr,
      hasCountryPack:    !!countryPack,
      hasTenantOverride: true,
    },
  }
}

// ── Bulk resolver ─────────────────────────────────────────────

export async function resolveTenantProcedures(
  tenantId: string,
  options?: {
    category?:    string
    activeOnly?:  boolean
    pricedOnly?:  boolean
    branchId?:    string
  }
): Promise<ResolvedProcedure[]> {
  const where: Prisma.ProcedureCatalogWhereInput = { tenantId }
  if (options?.category) where.category = options.category
  if (options?.activeOnly !== false) where.isActive = true

  const procs = await db.procedureCatalog.findMany({
    where,
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  const resolved = await Promise.all(
    procs.map(p =>
      resolveProcedure(p.id, tenantId, options?.branchId)
    )
  )

  const valid = resolved.filter(Boolean) as ResolvedProcedure[]

  if (options?.pricedOnly) {
    return valid.filter(p => p.isPriced)
  }

  return valid
}

// ── Pre-clinical check engine ─────────────────────────────────

export async function runPreClinicalChecks(
  procedureId: string,
  tenantId: string,
  patientId: string
): Promise<PreClinicalCheck[]> {
  const checks: PreClinicalCheck[] = []

  const resolved = await resolveProcedure(procedureId, tenantId)
  if (!resolved) return checks

  // Fetch patient medical data
  const patient = await db.patient.findFirst({
    where: { id: patientId, tenantId },
    select: {
      allergies: true,
      dateOfBirth: true,
      gender: true,
    },
  })

  // Build patient condition list from what we know
  const patientConditions: string[] = []
  const allergies = patient?.allergies ?? []

  // Allergy-based conditions
  if (allergies.some(a =>
    a.toLowerCase().includes("fluoride")
  )) {
    patientConditions.push("fluoride_allergy")
  }
  if (allergies.some(a =>
    ["lidocaine", "lignocaine", "local anaesthetic",
     "local anesthetic", "articaine"].some(t =>
       a.toLowerCase().includes(t)
     )
  )) {
    patientConditions.push("local_anaesthetic_allergy")
  }
  if (allergies.some(a =>
    ["latex", "rubber"].some(t => a.toLowerCase().includes(t))
  )) {
    patientConditions.push("latex_allergy")
  }
  if (allergies.some(a =>
    ["mercury", "amalgam"].some(t => a.toLowerCase().includes(t))
  )) {
    patientConditions.push("mercury_sensitivity")
  }
  if (allergies.some(a =>
    ["nickel"].some(t => a.toLowerCase().includes(t))
  )) {
    patientConditions.push("nickel_allergy")
  }
  if (allergies.some(a =>
    ["penicillin", "amoxicillin", "augmentin"].some(t =>
      a.toLowerCase().includes(t)
    )
  )) {
    patientConditions.push("penicillin_allergy")
  }

  // ── Check contraindications ──────────────────────────────────
  for (const ci of resolved.contraindications) {
    if (patientConditions.includes(ci.condition)) {
      checks.push({
        type:
          ci.severity === "WARNING"
            ? "WARN"
            : ci.severity === "BLOCK"
              ? "BLOCK"
              : "INFO",
        code:        `CI_${ci.condition.toUpperCase()}`,
        message:     ci.message,
        canOverride: ci.severity !== "BLOCK",
      })
    }
  }

  // ── Check consent requirement ────────────────────────────────
  if (resolved.requiresConsent) {
    // Check if a signed consent exists for this patient
    const hasConsent = await db.consentForm
      .findFirst({
        where: {
          tenantId,
          patientId,
          status: "SIGNED",
        },
      })
      .catch(() => null)

    if (!hasConsent) {
      checks.push({
        type:        "WARN",
        code:        "CONSENT_REQUIRED",
        message:
          "This procedure requires a signed consent form. " +
          "Please obtain patient consent before proceeding.",
        canOverride: true,
      })
    }
  }

  // ── Check X-ray requirement ──────────────────────────────────
  if (resolved.requiresXray) {
    checks.push({
      type:        "INFO",
      code:        "XRAY_RECOMMENDED",
      message:
        "An up-to-date radiograph is recommended " +
        "before this procedure. Confirm one is available.",
      canOverride: true,
    })
  }

  // ── Check pre-auth requirement ───────────────────────────────
  if (resolved.requiresPreAuth) {
    checks.push({
      type:        "WARN",
      code:        "PREAUTH_REQUIRED",
      message:
        "Pre-authorization may be required from the patient's " +
        "insurance provider. Confirm with reception before starting.",
      canOverride: true,
    })
  }

  // ── Check procedure is priced ────────────────────────────────
  if (!resolved.isPriced) {
    checks.push({
      type:        "INFO",
      code:        "NOT_PRICED",
      message:
        "This procedure has no selling price set. " +
        "It cannot be added to an invoice until priced. " +
        "Contact your administrator to set the price.",
      canOverride: true,
    })
  }

  return checks
}

// ── Unpriced procedure count (for sidebar badge) ──────────────

export async function getUnpricedCount(
  tenantId: string
): Promise<number> {
  return db.procedureCatalog.count({
    where: {
      tenantId,
      isActive: true,
      sellingPrice: null,
    },
  })
}