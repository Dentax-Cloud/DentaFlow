// ============================================================
// Procedure Catalog Admin Page
// Server component — fetches data, passes to client
// DentaFlow NEVER sets prices — tenant admin sets all prices
// ============================================================

export const runtime = "nodejs"

import { requireTenantContext }       from "@/lib/tenant/context"
import { db }                         from "@/lib/db"
import {
  getTenantProcedures,
  getAvailableGPMRProcedures,
  getBundles,
  getProcedureCategories,
  getUnpricedProcedureCount,
}                                     from "@/app/(dashboard)/admin/procedure-actions"
import ProcedureCatalogClient         from "./procedure-catalog-client"

export default async function ProcedureCatalogPage() {
  const ctx = await requireTenantContext()

  // Fetch tenant settings
  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: {
      countryCode:     true,
      currency:        true,
      currencySymbol:  true,
      name:            true,
      taxName:         true,
    },
  })

  // Fetch branches for branch price overrides
  const branches = await db.branch.findMany({
    where:   { tenantId: ctx.tenantId, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  }).catch(() => [])

  // Parallel data fetch
  const [
    procedures,
    availableGPMR,
    bundles,
    categories,
    unpricedCount,
    gpmrTotal,
  ] = await Promise.all([
    getTenantProcedures({ activeOnly: true }),
    getAvailableGPMRProcedures(),
    getBundles(),
    getProcedureCategories(),
    getUnpricedProcedureCount(),
    db.globalProcedure.count({ where: { isActive: true } }),
  ])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Procedure Catalog</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your clinic&apos;s procedure list, set prices and
          import from the global procedure library.
          {tenant?.name && ` · ${tenant.name}`}
        </p>
      </div>

      <ProcedureCatalogClient
        procedures={procedures}
        availableGPMR={availableGPMR}
        bundles={bundles}
        categories={categories}
        unpricedCount={unpricedCount}
        currency={tenant?.currency        ?? "AED"}
        currencySymbol={tenant?.currencySymbol ?? "AED"}
        countryCode={tenant?.countryCode  ?? "AE"}
        taxName={tenant?.taxName          ?? "VAT"}
        branches={branches}
        gpmrTotal={gpmrTotal}
      />
    </div>
  )
}