"use server"
// ============================================================
// Procedure Catalog Server Actions
// CRITICAL RULE: DentaFlow NEVER sets or suggests any price
// ALL prices are set exclusively by tenant admin
// Procedures imported with NULL prices — tenant must price them
// ============================================================

import { requireTenantContext } from "@/lib/tenant/context"
import { requirePermission } from "@/lib/rbac/guard"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { db }                   from "@/lib/db"
import { revalidatePath }       from "next/cache"
import { randomUUID }           from "crypto"
import { generateProcedureRef, peekProcedureRef } from "@/lib/ids/generate-ids"
import type { Prisma } from "@prisma/client"
import type {
  ContraindicationRule,
  PrerequisiteRule,
} from "@/lib/procedures/procedure-resolver"

type PackComplianceRules = {
  consentRequired?: boolean
  xrayRequired?: boolean
}

type PackInsuranceCodes = {
  requiresPreAuth?: boolean
}

/** DB `price` uses 0 as the unpriced sentinel; API layer exposes `sellingPrice: null`. */
const UNPRICED_DB_PRICE = 0

async function requireAdminWritePermission() {
  await requirePermission(PERMISSIONS.admin.write)
}

async function requireAdminReadPermission() {
  await requirePermission(PERMISSIONS.admin.read)
}

function sellingPriceFromDb(price: Prisma.Decimal | number): number | null {
  const n = Number(price)
  return n > UNPRICED_DB_PRICE ? n : null
}

function dbPriceFromSelling(selling: number | null | undefined): number {
  return selling != null && selling > UNPRICED_DB_PRICE ? selling : UNPRICED_DB_PRICE
}

function durationMinsFromDb(duration: number | null | undefined): number {
  return duration ?? 30
}

// ── Import procedures from GPMR into tenant catalog ──────────
// Prices imported as NULL — tenant admin must set all prices

export async function importFromGPMR(
  gpmrIds?: string[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { countryCode: true, currency: true },
  })

  const countryCode = tenant?.countryCode ?? "AE"

  // Fetch GPMR procedures — all active, or specific ones
  const gpmrProcs = await db.globalProcedure.findMany({
    where: {
      isActive: true,
      ...(gpmrIds && gpmrIds.length > 0
        ? { id: { in: gpmrIds } }
        : {}),
    },
    include: {
      countryPacks: {
        where: { countryCode, isActive: true },
      },
    },
    orderBy: [{ category: "asc" }, { canonicalName: "asc" }],
  })

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (const gpmr of gpmrProcs) {
    try {
      // Skip if already imported for this tenant
      const existing = await db.procedureCatalog.findFirst({
        where: { tenantId: ctx.tenantId, gpmrId: gpmr.id },
      })

      if (existing) {
        skipped++
        continue
      }

      const pack      = gpmr.countryPacks[0] ?? null
      const gpmrNames = (gpmr.names ?? {}) as Record<string, string>

      // Resolve local name
      const localName =
        pack?.localName ||
        gpmrNames[`en-${countryCode}`] ||
        gpmrNames["en"] ||
        gpmr.canonicalName

      // Resolve local code
      const localCodes =
        (pack?.localCodes ?? {}) as Record<string, string>
      const primaryCode =
        localCodes.DHA   ||
        localCodes.CDT   ||
        localCodes.NHS   ||
        localCodes.CCHI  ||
        localCodes.NPHIES||
        gpmr.gpmrCode

      // Resolve compliance from country pack
      const packCompliance =
        (pack?.complianceRules ?? {}) as PackComplianceRules
      const packInsurance  =
        (pack?.insuranceCodes  ?? {}) as PackInsuranceCodes

      // CRITICAL: All prices are null
      // Tenant admin must set prices before procedures can be invoiced
      await db.procedureCatalog.create({
        data: {
          id:              randomUUID(),
          tenantId:        ctx.tenantId,
          gpmrId:          gpmr.id,
          code:            primaryCode,
          name:            localName,
          nameAr:          pack?.localNameAr ?? null,
          category:        gpmr.category,
          duration:        gpmr.defaultDurationMins,
          // ── PRICES: intentionally unpriced (0 sentinel) ─────
          price:           UNPRICED_DB_PRICE,
          costPrice:       null,
          isActive:        true,
          isOnlineBookable:false,
          requiresConsent: packCompliance.consentRequired  === true,
          requiresXray:    packCompliance.xrayRequired     === true,
          requiresPreAuth: packInsurance.requiresPreAuth   === true,
          sortOrder:       imported,
        },
      })

      imported++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(
        `Failed to import ${gpmr.gpmrCode}: ${message}`
      )
    }
  }

  revalidatePath("/admin/procedure-catalog")
  return { imported, skipped, errors }
}

// ── Set procedure price ───────────────────────────────────────
// The ONLY place prices are written — by tenant admin only

export async function setProcedurePrice(
  procedureId: string,
  prices: {
    sellingPrice?: number | null
    costPrice?:    number | null
    branchPrices?: Record<string, {
      sellingPrice?: number | null
      costPrice?:    number | null
    }>
  }
): Promise<void> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  // Verify procedure belongs to this tenant
  const procedure = await db.procedureCatalog.findFirst({
    where: { id: procedureId, tenantId: ctx.tenantId },
  })

  if (!procedure) {
    throw new Error("Procedure not found")
  }

  // Validate: prices cannot be negative
  if (
    prices.sellingPrice !== undefined &&
    prices.sellingPrice !== null &&
    prices.sellingPrice < 0
  ) {
    throw new Error("Selling price cannot be negative")
  }
  if (
    prices.costPrice !== undefined &&
    prices.costPrice !== null &&
    prices.costPrice < 0
  ) {
    throw new Error("Cost price cannot be negative")
  }

  const updateData: Prisma.ProcedureCatalogUpdateInput = {
    updatedAt: new Date(),
  }

  if (prices.sellingPrice !== undefined) {
    updateData.price = dbPriceFromSelling(prices.sellingPrice)
  }
  if (prices.costPrice !== undefined) {
    updateData.costPrice = prices.costPrice
  }
  if (prices.branchPrices !== undefined) {
    updateData.branchPrices = prices.branchPrices
  }

  await db.procedureCatalog.update({
    where: { id: procedureId },
    data:  updateData,
  })

  revalidatePath("/admin/procedure-catalog")
}

// ── Bulk set prices ───────────────────────────────────────────
// Used in onboarding bulk price entry form

export async function bulkSetPrices(
  prices: Array<{
    procedureId:  string
    sellingPrice: number | null
    costPrice:    number | null
  }>
): Promise<{ updated: number; errors: string[] }> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()
  let updated = 0
  const errors: string[] = []

  for (const item of prices) {
    try {
      // Skip if both prices are null (no change)
      if (
        item.sellingPrice === null &&
        item.costPrice    === null
      ) {
        continue
      }

      // Validate no negative prices
      if (item.sellingPrice !== null && item.sellingPrice < 0) {
        errors.push(
          `Procedure ${item.procedureId}: selling price cannot be negative`
        )
        continue
      }
      if (item.costPrice !== null && item.costPrice < 0) {
        errors.push(
          `Procedure ${item.procedureId}: cost price cannot be negative`
        )
        continue
      }

      await db.procedureCatalog.updateMany({
        where: {
          id:       item.procedureId,
          tenantId: ctx.tenantId,
        },
        data: {
          price:     dbPriceFromSelling(item.sellingPrice),
          costPrice: item.costPrice,
          updatedAt: new Date(),
        },
      })

      updated++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(
        `Failed to update ${item.procedureId}: ${message}`
      )
    }
  }

  revalidatePath("/admin/procedure-catalog")
  return { updated, errors }
}

// ── Get tenant procedures ─────────────────────────────────────

export async function getTenantProcedures(options?: {
  category?:     string
  pricedOnly?:   boolean
  unpricedOnly?: boolean
  activeOnly?:   boolean
  search?:       string
}) {
  await requireAdminReadPermission()
  const ctx = await requireTenantContext()

  const where: Prisma.ProcedureCatalogWhereInput = { tenantId: ctx.tenantId }

  if (options?.activeOnly !== false) {
    where.isActive = true
  }
  if (options?.category) {
    where.category = options.category
  }
  if (options?.pricedOnly) {
    where.price = { gt: UNPRICED_DB_PRICE }
  }
  if (options?.unpricedOnly) {
    where.price = UNPRICED_DB_PRICE
  }
  if (options?.search) {
    where.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { code: { contains: options.search, mode: "insensitive" } },
    ]
  }

  const procs = await db.procedureCatalog.findMany({
    where,
    include: {
      globalProcedure: {
        select: {
          gpmrCode:           true,
          canonicalName:      true,
          category:           true,
          defaultDurationMins:true,
          contraindications:  true,
          prerequisites:      true,
          modules:            true,
          isBillable:         true,
          canBundle:          true,
        },
      },
    },
    orderBy: [
      { category:  "asc" },
      { sortOrder: "asc" },
      { name:      "asc" },
    ],
  })

  return procs.map(p => {
    const sellingPrice = sellingPriceFromDb(p.price)
    const costPrice =
      p.costPrice != null ? Number(p.costPrice) : null

    const margin =
      sellingPrice !== null && costPrice !== null
        ? sellingPrice - costPrice
        : null

    const marginPct =
      sellingPrice !== null &&
      costPrice    !== null &&
      sellingPrice > 0
        ? ((sellingPrice - costPrice) / sellingPrice * 100).toFixed(1)
        : null

    return {
      id:              p.id,
      code:            p.code,
      name:            p.name,
      nameAr:          p.nameAr,
      category:        p.category ?? "UNCATEGORIZED",
      durationMins:    durationMinsFromDb(p.duration),
      isActive:        p.isActive,
      isOnlineBookable:p.isOnlineBookable,
      requiresConsent: p.requiresConsent,
      requiresXray:    p.requiresXray,
      requiresPreAuth: p.requiresPreAuth,
      sortOrder:       p.sortOrder,
      branchPrices:    p.branchPrices,
      workflowConfig:  p.workflowConfig,
      // Prices — set by tenant only
      sellingPrice,
      costPrice,
      isPriced:  sellingPrice !== null,
      margin,
      marginPct,
      // GPMR info
      gpmrCode:
        p.globalProcedure?.gpmrCode ?? null,
      gpmrCanonicalName:
        p.globalProcedure?.canonicalName ?? null,
      isFromGPMR: !!p.gpmrId,
      isBillable:
        p.globalProcedure?.isBillable ?? true,
      canBundle:
        p.globalProcedure?.canBundle ?? true,
      modules:
        (p.globalProcedure?.modules as string[]) ?? [],
      contraindications:
        (p.globalProcedure?.contraindications as ContraindicationRule[]) ?? [],
      prerequisites:
        (p.globalProcedure?.prerequisites as PrerequisiteRule[]) ?? [],
    }
  })
}

// ── Get GPMR procedures not yet imported ──────────────────────

export async function getAvailableGPMRProcedures(options?: {
  category?: string
  search?:   string
}) {
  await requireAdminReadPermission()
  const ctx = await requireTenantContext()

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { countryCode: true },
  })

  const countryCode = tenant?.countryCode ?? "AE"

  // Get already imported GPMR ids
  const imported = await db.procedureCatalog.findMany({
    where: {
      tenantId: ctx.tenantId,
      gpmrId:   { not: null },
    },
    select: { gpmrId: true },
  })

  const importedIds = imported
    .map(p => p.gpmrId)
    .filter(Boolean) as string[]

  const where: Prisma.GlobalProcedureWhereInput = {
    isActive: true,
    id:       { notIn: importedIds },
  }

  if (options?.category) {
    where.category = options.category
  }
  if (options?.search) {
    where.canonicalName = {
      contains: options.search,
      mode: "insensitive",
    }
  }

  const gpmrProcs = await db.globalProcedure.findMany({
    where,
    include: {
      countryPacks: {
        where: { countryCode, isActive: true },
      },
    },
    orderBy: [{ category: "asc" }, { canonicalName: "asc" }],
  })

  return gpmrProcs.map(g => {
    const pack      = g.countryPacks[0] ?? null
    const names     = (g.names ?? {}) as Record<string, string>
    const localName =
      pack?.localName ||
      names[`en-${countryCode}`] ||
      names["en"] ||
      g.canonicalName

    const localCodes =
      (pack?.localCodes ?? {}) as Record<string, string>
    const primaryCode =
      localCodes.DHA   ||
      localCodes.CDT   ||
      localCodes.NHS   ||
      localCodes.CCHI  ||
      g.gpmrCode

    return {
      id:               g.id,
      gpmrCode:         g.gpmrCode,
      localName,
      localNameAr:      pack?.localNameAr ?? null,
      category:         g.category,
      subCategory:      g.subCategory,
      durationMins:     g.defaultDurationMins,
      primaryCode,
      localCodes,
      isBillable:       g.isBillable,
      canBundle:        g.canBundle,
      modules:          (g.modules as string[]) ?? [],
      hasCountryPack:   !!pack,
    }
  })
}

// ── Create custom procedure ───────────────────────────────────
// Not linked to GPMR — clinic-specific procedure

export async function createCustomProcedure(input: {
  name:            string
  nameAr?:         string
  category:        string
  durationMins:    number
  sellingPrice?:   number | null
  costPrice?:      number | null
  requiresConsent?:boolean
  requiresXray?:   boolean
  requiresPreAuth?:boolean
  isOnlineBookable?:boolean
}): Promise<{ id: string; code: string }> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  const code = await generateProcedureRef(ctx.tenantId, input.category)

  // Safety net — duplicate codes should not occur with sequential refs
  const existing = await db.procedureCatalog.findFirst({
    where: {
      tenantId: ctx.tenantId,
      code,
    },
  })

  if (existing) {
    throw new Error(
      `Procedure code "${code}" already exists in your catalog. ` +
      `Please try again.`
    )
  }

  // Validate prices if provided
  if (
    input.sellingPrice !== undefined &&
    input.sellingPrice !== null &&
    input.sellingPrice < 0
  ) {
    throw new Error("Selling price cannot be negative")
  }

  const id = randomUUID()

  await db.procedureCatalog.create({
    data: {
      id,
      tenantId:        ctx.tenantId,
      gpmrId:          null,    // custom — not from GPMR
      code,
      name:            input.name.trim(),
      nameAr:          input.nameAr?.trim() ?? null,
      category:        input.category,
      duration:        input.durationMins,
      price:           dbPriceFromSelling(input.sellingPrice),
      costPrice:       input.costPrice ?? null,
      isActive:        true,
      isOnlineBookable:input.isOnlineBookable ?? false,
      requiresConsent: input.requiresConsent  ?? false,
      requiresXray:    input.requiresXray     ?? false,
      requiresPreAuth: input.requiresPreAuth  ?? false,
      sortOrder:       0,
    },
  })

  revalidatePath("/admin/procedure-catalog")
  return { id, code }
}

export async function previewProcedureCode(category: string): Promise<string> {
  await requireAdminReadPermission()
  const ctx = await requireTenantContext()
  return peekProcedureRef(ctx.tenantId, category)
}

// ── Update procedure settings ─────────────────────────────────

export async function updateProcedure(
  procedureId: string,
  input: {
    name?:           string
    nameAr?:         string
    durationMins?:   number
    isActive?:       boolean
    isOnlineBookable?:boolean
    requiresConsent?:boolean
    requiresXray?:   boolean
    requiresPreAuth?:boolean
    sortOrder?:      number
    workflowConfig?: Prisma.InputJsonValue
  }
): Promise<void> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  const { durationMins, ...rest } = input
  await db.procedureCatalog.updateMany({
    where: { id: procedureId, tenantId: ctx.tenantId },
    data: {
      ...rest,
      ...(durationMins !== undefined ? { duration: durationMins } : {}),
      updatedAt: new Date(),
    },
  })

  revalidatePath("/admin/procedure-catalog")
}

// ── Toggle active status ──────────────────────────────────────

export async function toggleProcedureActive(
  procedureId: string,
  isActive:    boolean
): Promise<void> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  await db.procedureCatalog.updateMany({
    where: { id: procedureId, tenantId: ctx.tenantId },
    data:  { isActive, updatedAt: new Date() },
  })

  revalidatePath("/admin/procedure-catalog")
}

// ── Delete custom procedure ───────────────────────────────────
// Only allowed for custom procedures (not GPMR-imported ones)

export async function deleteCustomProcedure(
  procedureId: string
): Promise<void> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  const procedure = await db.procedureCatalog.findFirst({
    where: { id: procedureId, tenantId: ctx.tenantId },
    select: { gpmrId: true, code: true },
  })

  if (!procedure) {
    throw new Error("Procedure not found")
  }

  if (procedure.gpmrId) {
    throw new Error(
      "GPMR-linked procedures cannot be deleted. " +
      "Deactivate them instead using the toggle."
    )
  }

  await db.procedureCatalog.delete({
    where: { id: procedureId },
  })

  revalidatePath("/admin/procedure-catalog")
}

// ── Manage bundles ────────────────────────────────────────────

export async function createBundle(input: {
  name:             string
  description?:     string
  bundlePrice:      number | null
  durationMins:     number
  isOnlineBookable?:boolean
  items: Array<{
    procedureCatalogId: string
    displayOrder:       number
  }>
}): Promise<string> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { currency: true },
  })

  // Validate bundle price if provided
  if (
    input.bundlePrice !== null &&
    input.bundlePrice !== undefined &&
    input.bundlePrice < 0
  ) {
    throw new Error("Bundle price cannot be negative")
  }

  const id = randomUUID()

  await db.procedureBundle.create({
    data: {
      id,
      tenantId:        ctx.tenantId,
      name:            input.name,
      description:     input.description     ?? null,
      bundlePrice:     input.bundlePrice,
      currency:        tenant?.currency      ?? "AED",
      durationMins:    input.durationMins,
      items:           input.items,
      isActive:        true,
      isOnlineBookable:input.isOnlineBookable ?? false,
    },
  })

  revalidatePath("/admin/procedure-catalog")
  return id
}

export async function updateBundle(
  bundleId: string,
  input: {
    name?:            string
    description?:     string
    bundlePrice?:     number | null
    durationMins?:    number
    isActive?:        boolean
    isOnlineBookable?:boolean
    items?: Array<{
      procedureCatalogId: string
      displayOrder:       number
    }>
  }
): Promise<void> {
  await requireAdminWritePermission()
  const ctx = await requireTenantContext()

  await db.procedureBundle.updateMany({
    where: { id: bundleId, tenantId: ctx.tenantId },
    data:  { ...input, updatedAt: new Date() },
  })

  revalidatePath("/admin/procedure-catalog")
}

export async function getBundles() {
  await requireAdminReadPermission()
  const ctx = await requireTenantContext()

  const bundles = await db.procedureBundle.findMany({
    where:   { tenantId: ctx.tenantId, isActive: true },
    orderBy: { name: "asc" },
  })

  return bundles.map(b => ({
    ...b,
    bundlePrice: b.bundlePrice ? Number(b.bundlePrice) : null,
    items:       b.items as Array<{
      procedureCatalogId: string
      displayOrder:       number
    }>,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }))
}

// ── Get procedure categories ──────────────────────────────────

export async function getProcedureCategories(): Promise<string[]> {
  await requireAdminReadPermission()
  const ctx = await requireTenantContext()

  const result = await db.procedureCatalog.findMany({
    where:    { tenantId: ctx.tenantId, isActive: true },
    select:   { category: true },
    distinct: ["category"],
    orderBy:  { category: "asc" },
  })

  return result
    .map(r => r.category)
    .filter((c): c is string => c != null)
}

// ── Get unpriced count for sidebar badge ─────────────────────

export async function getUnpricedProcedureCount(): Promise<number> {
  await requireAdminReadPermission()
  const ctx = await requireTenantContext()

  return db.procedureCatalog.count({
    where: {
      tenantId:     ctx.tenantId,
      isActive:     true,
      price:        UNPRICED_DB_PRICE,
    },
  })
}