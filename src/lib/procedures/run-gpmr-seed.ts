// ============================================================
// GPMR Seed Runner
// Populates GlobalProcedure and CountryProcedurePack tables
// Run once via: POST /api/superadmin/seed-gpmr
// Safe to re-run — uses upsert (no duplicates)
// ============================================================

import { db } from "@/lib/db"
import { GPMR_PROCEDURES, COUNTRY_PACKS } from "./gpmr-seed"
import { randomUUID } from "crypto"
import type { Prisma } from "@prisma/client"

type GpmrSeedProcedure = (typeof GPMR_PROCEDURES)[number] & {
  subCategory?: string | null
  clinicalDescription?: string | null
  archRequired?: boolean
  quadrantRequired?: boolean
  requiredInputs?: Prisma.InputJsonValue
  optionalInputs?: Prisma.InputJsonValue
  prerequisites?: Prisma.InputJsonValue
  contraindications?: Prisma.InputJsonValue
  postProcedureActions?: Prisma.InputJsonValue
  requiredAttachments?: Prisma.InputJsonValue
  optionalAttachments?: Prisma.InputJsonValue
  globalCodes?: Prisma.InputJsonValue
  modules?: Prisma.InputJsonValue
  aiSuggestTriggers?: Prisma.InputJsonValue
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export type SeedResult = {
  procedures: { created: number; updated: number }
  countryPacks: { created: number; updated: number }
  errors: string[]
}

export async function seedGPMR(): Promise<SeedResult> {
  console.log("[GPMR Seed] Starting...")

  const result: SeedResult = {
    procedures: { created: 0, updated: 0 },
    countryPacks: { created: 0, updated: 0 },
    errors: [],
  }

  // ── Step 1: Seed GlobalProcedure records ─────────────────────
  for (const proc of GPMR_PROCEDURES) {
    try {
      const seedProc = proc as GpmrSeedProcedure
      const existing = await db.globalProcedure.findUnique({
        where: { gpmrCode: proc.gpmrCode },
      })

      const data = {
        canonicalName:        proc.canonicalName,
        names:                toJson(proc.names),
        category:             proc.category,
        subCategory:          seedProc.subCategory ?? null,
        clinicalDescription:  seedProc.clinicalDescription ?? null,
        defaultDurationMins:  proc.defaultDurationMins,
        toothRequired:        proc.toothRequired,
        surfaceRequired:      proc.surfaceRequired,
        archRequired:         seedProc.archRequired ?? false,
        quadrantRequired:     seedProc.quadrantRequired ?? false,
        requiredInputs:       toJson(seedProc.requiredInputs ?? []),
        optionalInputs:       toJson(seedProc.optionalInputs ?? []),
        prerequisites:        toJson(seedProc.prerequisites ?? []),
        contraindications:    toJson(seedProc.contraindications ?? []),
        postProcedureActions: toJson(seedProc.postProcedureActions ?? []),
        requiredAttachments:  toJson(seedProc.requiredAttachments ?? []),
        optionalAttachments:  toJson(seedProc.optionalAttachments ?? []),
        globalCodes:          toJson(seedProc.globalCodes ?? {}),
        modules:              toJson(seedProc.modules ?? []),
        isBillable:           proc.isBillable,
        canBundle:            proc.canBundle,
        aiSuggestTriggers:    toJson(seedProc.aiSuggestTriggers ?? []),
        isActive:             true,
        version:              "1.0.0",
      }

      if (existing) {
        await db.globalProcedure.update({
          where: { gpmrCode: proc.gpmrCode },
          data: { ...data, updatedAt: new Date() },
        })
        result.procedures.updated++
        console.log(`[GPMR Seed] Updated: ${proc.gpmrCode}`)
      } else {
        await db.globalProcedure.create({
          data: {
            id: randomUUID(),
            gpmrCode: proc.gpmrCode,
            ...data,
          },
        })
        result.procedures.created++
        console.log(`[GPMR Seed] Created: ${proc.gpmrCode}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const msg = `Failed to seed ${proc.gpmrCode}: ${message}`
      console.error(`[GPMR Seed] ERROR: ${msg}`)
      result.errors.push(msg)
    }
  }

  // ── Step 2: Seed CountryProcedurePack records ─────────────────
  for (const [countryCode, packs] of Object.entries(COUNTRY_PACKS)) {
    console.log(
      `[GPMR Seed] Processing country pack: ${countryCode} ` +
      `(${packs.length} procedures)`
    )

    for (const pack of packs) {
      try {
        // Find the GlobalProcedure by gpmrCode
        const gpmr = await db.globalProcedure.findUnique({
          where: { gpmrCode: pack.gpmrCode },
          select: { id: true },
        })

        if (!gpmr) {
          const msg =
            `Country pack ${countryCode}: ` +
            `GPMR procedure not found: ${pack.gpmrCode}`
          console.warn(`[GPMR Seed] WARN: ${msg}`)
          result.errors.push(msg)
          continue
        }

        const packData = {
          packVersion:       "1.0.0",
          localName:         pack.localName ?? null,
          localNameAr:       pack.localNameAr ?? null,
          localNames:        toJson({}),
          localCodes:        toJson(pack.localCodes),
          taxRules:          toJson(pack.taxRules),
          insuranceCodes:    toJson(pack.insuranceCodes),
          complianceRules:   toJson(pack.complianceRules),
          workflowAdditions: toJson(pack.workflowAdditions ?? {}),
          isActive:          true,
          effectiveFrom:     new Date(),
        }

        const existing = await db.countryProcedurePack.findUnique({
          where: {
            gpmrId_countryCode: {
              gpmrId: gpmr.id,
              countryCode,
            },
          },
        })

        if (existing) {
          await db.countryProcedurePack.update({
            where: {
              gpmrId_countryCode: {
                gpmrId: gpmr.id,
                countryCode,
              },
            },
            data: packData,
          })
          result.countryPacks.updated++
        } else {
          await db.countryProcedurePack.create({
            data: {
              id: randomUUID(),
              gpmrId: gpmr.id,
              countryCode,
              ...packData,
            },
          })
          result.countryPacks.created++
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        const msg =
          `Failed to seed pack ${countryCode}/${pack.gpmrCode}: ` +
          `${message}`
        console.error(`[GPMR Seed] ERROR: ${msg}`)
        result.errors.push(msg)
      }
    }
  }

  // ── Step 3: Summary ───────────────────────────────────────────
  console.log("[GPMR Seed] Complete.")
  console.log(
    `  Procedures: ${result.procedures.created} created, ` +
    `${result.procedures.updated} updated`
  )
  console.log(
    `  Country packs: ${result.countryPacks.created} created, ` +
    `${result.countryPacks.updated} updated`
  )
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`)
    result.errors.forEach(e => console.log(`    - ${e}`))
  }

  return result
}

// ── Verify seed integrity ─────────────────────────────────────
export async function verifySeed(): Promise<{
  totalProcedures: number
  totalCountryPacks: number
  countryCoverage: Record<string, number>
  missingPacks: string[]
}> {
  const totalProcedures = await db.globalProcedure.count({
    where: { isActive: true },
  })

  const totalCountryPacks = await db.countryProcedurePack.count({
    where: { isActive: true },
  })

  // Count packs per country
  const packsByCountry = await db.countryProcedurePack.groupBy({
    by: ["countryCode"],
    _count: { id: true },
    where: { isActive: true },
  })

  const countryCoverage: Record<string, number> = {}
  for (const row of packsByCountry) {
    countryCoverage[row.countryCode] = row._count.id
  }

  // Find GPMR procedures with no country packs at all
  const allGpmr = await db.globalProcedure.findMany({
    where: { isActive: true },
    select: { gpmrCode: true, _count: { select: { countryPacks: true } } },
  })

  const missingPacks = allGpmr
    .filter(g => g._count.countryPacks === 0)
    .map(g => g.gpmrCode)

  return {
    totalProcedures,
    totalCountryPacks,
    countryCoverage,
    missingPacks,
  }
}