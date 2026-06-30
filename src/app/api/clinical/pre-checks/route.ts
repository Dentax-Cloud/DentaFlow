// ============================================================
// Clinical Pre-Checks API
// GET /api/clinical/pre-checks?procedureId=X&patientId=Y
// Returns contraindication and compliance warnings
// before a procedure is started in chairside
// ============================================================

export const runtime = "nodejs"

import { getServerAuthSession }  from "@/lib/auth"
import { requireTenantContext }  from "@/lib/tenant/context"
import { NextResponse }          from "next/server"
import { runPreClinicalChecks }  from "@/lib/procedures/procedure-resolver"

export async function GET(request: Request) {
  try {
    // Auth check
    const session = await getServerAuthSession()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Tenant context
    const ctx = await requireTenantContext()

    // Parse query params
    const { searchParams } = new URL(request.url)
    const procedureId      = searchParams.get("procedureId")
    const patientId        = searchParams.get("patientId")

    if (!procedureId || !patientId) {
      return NextResponse.json(
        {
          error:
            "Both procedureId and patientId are required query parameters",
        },
        { status: 400 }
      )
    }

    // Run pre-clinical checks
    const checks = await runPreClinicalChecks(
      procedureId,
      ctx.tenantId,
      patientId
    )

    // Separate by type for easier client handling
    const blocks   = checks.filter(c => c.type === "BLOCK")
    const warnings = checks.filter(c => c.type === "WARN")
    const infos    = checks.filter(c => c.type === "INFO")

    const canProceed = blocks.length === 0

    return NextResponse.json({
      checks,
      summary: {
        total:      checks.length,
        blocks:     blocks.length,
        warnings:   warnings.length,
        infos:      infos.length,
        canProceed,
      },
      // Convenience: flat message if blocked
      blockedReason: blocks.length > 0
        ? blocks.map(b => b.message).join(" | ")
        : null,
    })
  } catch (err: unknown) {
    console.error("[Pre-Checks] Error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}