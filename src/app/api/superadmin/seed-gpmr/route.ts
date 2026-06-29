// ============================================================
// Superadmin API — Seed GPMR
// POST /api/superadmin/seed-gpmr
// Populates GlobalProcedure + CountryProcedurePack tables
// Safe to re-run (upsert — no duplicates)
// Superadmin only
// ============================================================

export const runtime = "nodejs"

import { getServerAuthSession } from "@/lib/auth"
import { NextResponse }         from "next/server"
import { seedGPMR, verifySeed } from "@/lib/procedures/run-gpmr-seed"

export async function POST() {
  try {
    // Superadmin check
    const session = await getServerAuthSession()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!session.user.isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden — superadmin only" },
        { status: 403 }
      )
    }

    console.log(
      `[GPMR Seed] Triggered by superadmin: ${session.user.email}`
    )

    // Run seed
    const result = await seedGPMR()

    // Verify after seeding
    const verification = await verifySeed()

    return NextResponse.json({
      success:      true,
      seeded: {
        proceduresCreated: result.procedures.created,
        proceduresUpdated: result.procedures.updated,
        packsCreated:      result.countryPacks.created,
        packsUpdated:      result.countryPacks.updated,
        errors:            result.errors,
      },
      verification: {
        totalProcedures:  verification.totalProcedures,
        totalPacks:       verification.totalCountryPacks,
        countryCoverage:  verification.countryCoverage,
        missingPacks:     verification.missingPacks,
      },
      message:
        result.errors.length === 0
          ? `GPMR seeded successfully. ` +
            `${result.procedures.created} procedures created, ` +
            `${result.countryPacks.created} country packs created.`
          : `GPMR seeded with ${result.errors.length} error(s). ` +
            `Check errors array for details.`,
    })
  } catch (err: any) {
    console.error("[GPMR Seed] Fatal error:", err)
    return NextResponse.json(
      {
        success: false,
        error:   err.message ?? "Unexpected error during GPMR seed",
      },
      { status: 500 }
    )
  }
}

// GET — check current GPMR status
export async function GET() {
  try {
    const session = await getServerAuthSession()

    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden — superadmin only" },
        { status: 403 }
      )
    }

    const verification = await verifySeed()

    return NextResponse.json({
      status:          "ok",
      totalProcedures: verification.totalProcedures,
      totalPacks:      verification.totalCountryPacks,
      countryCoverage: verification.countryCoverage,
      missingPacks:    verification.missingPacks,
      isSeeded:        verification.totalProcedures > 0,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}