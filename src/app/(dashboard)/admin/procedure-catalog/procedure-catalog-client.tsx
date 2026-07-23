"use client"
// ============================================================
// Procedure Catalog Client
// Tabs: My Procedures | Import from Library | Bundles
// CRITICAL: DentaFlow never sets prices
// All prices set exclusively by tenant admin
// ============================================================

import { useState, useTransition, useMemo, useEffect } from "react"
import { useRouter }                         from "next/navigation"
import { toast }                             from "sonner"
import {
  BookOpen, Plus, Search, Settings2,
  ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, Package, Layers,
} from "lucide-react"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import {
  importFromGPMR,
  setProcedurePrice,
  bulkSetPrices,
  createCustomProcedure,
  previewProcedureCode,
  updateProcedure,
  toggleProcedureActive,
  deleteCustomProcedure,
  createBundle,
  updateBundle,
} from "@/app/(dashboard)/admin/procedure-actions"
import { messageFromActionError } from "@/lib/rbac/action-errors"
import { ProcedureBomEditor, ProcedureBomPanel } from "./procedure-bom-panel"

function parseOptionalPrice(value: string): number | null {
  if (value === "" || value === null) return null
  return Number(value)
}

// ── Types ─────────────────────────────────────────────────────

type Procedure = {
  id:              string
  code:            string
  name:            string
  nameAr:          string | null
  category:        string
  durationMins:    number
  isActive:        boolean
  isOnlineBookable:boolean
  requiresConsent: boolean
  requiresXray:    boolean
  requiresPreAuth: boolean
  sellingPrice:    number | null
  costPrice:       number | null
  isPriced:        boolean
  margin:          number | null
  marginPct:       string | null
  gpmrCode:        string | null
  isFromGPMR:      boolean
  isBillable:      boolean
  canBundle:       boolean
  modules:         string[]
}

type GPMRProcedure = {
  id:           string
  gpmrCode:     string
  localName:    string
  localNameAr:  string | null
  category:     string
  subCategory:  string | null
  durationMins: number
  primaryCode:  string
  localCodes:   Record<string, string>
  isBillable:   boolean
  hasCountryPack:boolean
}

type Bundle = {
  id:              string
  name:            string
  description:     string | null
  bundlePrice:     number | null
  currency:        string
  durationMins:    number
  isActive:        boolean
  isOnlineBookable:boolean
  items: Array<{
    procedureCatalogId: string
    displayOrder:       number
  }>
}

type Branch = {
  id:   string
  name: string
}

type Props = {
  procedures:     Procedure[]
  availableGPMR:  GPMRProcedure[]
  bundles:        Bundle[]
  categories:     string[]
  unpricedCount:  number
  currency:       string
  currencySymbol: string
  countryCode:    string
  taxName:        string
  branches:       Branch[]
  gpmrTotal:      number
}

// ── Category colors ───────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  DIAGNOSTIC:    "bg-blue-100 text-blue-700",
  PREVENTIVE:    "bg-green-100 text-green-700",
  RESTORATIVE:   "bg-yellow-100 text-yellow-700",
  ENDODONTICS:   "bg-purple-100 text-purple-700",
  PERIODONTICS:  "bg-teal-100 text-teal-700",
  ORAL_SURGERY:  "bg-red-100 text-red-700",
  PROSTHODONTICS:"bg-orange-100 text-orange-700",
  IMPLANTOLOGY:  "bg-indigo-100 text-indigo-700",
  ORTHODONTICS:  "bg-pink-100 text-pink-700",
  COSMETIC:      "bg-rose-100 text-rose-700",
  PAEDIATRIC:    "bg-cyan-100 text-cyan-700",
  EMERGENCY:     "bg-red-100 text-red-700",
  ANAESTHESIA:   "bg-gray-100 text-gray-700",
  APPLIANCES:    "bg-slate-100 text-slate-700",
}

// ── Edit pricing panel ────────────────────────────────────────

function EditPricingPanel({
  procedure,
  currency,
  currencySymbol,
  branches,
  onSave,
  onClose,
}: {
  procedure:      Procedure
  currency:       string
  currencySymbol: string
  branches:       Branch[]
  onSave:         () => void
  onClose:        () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [sellingPrice, setSellingPrice] = useState(
    procedure.sellingPrice?.toString() ?? ""
  )
  const [costPrice, setCostPrice] = useState(
    procedure.costPrice?.toString() ?? ""
  )
  const [durationMins, setDurationMins] = useState(
    procedure.durationMins.toString()
  )
  const [requiresConsent,  setRequiresConsent]  =
    useState(procedure.requiresConsent)
  const [requiresXray,     setRequiresXray]     =
    useState(procedure.requiresXray)
  const [requiresPreAuth,  setRequiresPreAuth]  =
    useState(procedure.requiresPreAuth)
  const [isOnlineBookable, setIsOnlineBookable] =
    useState(procedure.isOnlineBookable)
  const [branchPrices, setBranchPrices] = useState<Record<string, string>>({})

  async function handleSave() {
    startTransition(async () => {
      try {
        // Set prices
        await setProcedurePrice(procedure.id, {
          sellingPrice: parseOptionalPrice(sellingPrice),
          costPrice:    parseOptionalPrice(costPrice),
          branchPrices: Object.fromEntries(
            Object.entries(branchPrices)
              .filter(([, v]) => v !== "")
              .map(([k, v]) => [k, { sellingPrice: Number(v) }])
          ),
        })

        // Update other settings
        await updateProcedure(procedure.id, {
          durationMins:    Number(durationMins) || 30,
          requiresConsent,
          requiresXray,
          requiresPreAuth,
          isOnlineBookable,
        })

        toast.success("Procedure updated")
        onSave()
        onClose()
      } catch (err: unknown) {
        toast.error(messageFromActionError(err))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl
        w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold text-lg">{procedure.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-muted-foreground">
              {procedure.code}
            </span>
            {procedure.gpmrCode && (
              <Badge variant="outline" className="text-xs">
                GPMR: {procedure.gpmrCode}
              </Badge>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* Pricing notice */}
          <div className="bg-blue-50 border border-blue-200
            rounded-lg p-3 text-xs text-blue-700">
            💡 Set your clinic&apos;s fees for this procedure.
            DentaFlow does not impose or suggest any prices.
          </div>

          {/* Selling price */}
          <div>
            <label className="text-sm font-semibold">
              Selling Price
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-1">
              What you charge patients. Required to add to invoices.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground w-12">
                {currencySymbol}
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                placeholder="0.00"
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Cost price */}
          <div>
            <label className="text-sm font-semibold">
              Cost Price
            </label>
            <p className="text-xs text-muted-foreground mb-1">
              What this procedure costs your clinic.
              Optional — used for margin reporting only.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground w-12">
                {currencySymbol}
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            {/* Live margin calculation */}
            {sellingPrice && costPrice && (
              <p className="text-xs text-green-600 mt-1">
                Margin:{" "}
                {currencySymbol}{" "}
                {(Number(sellingPrice) - Number(costPrice)).toFixed(2)}
                {" "}
                ({((Number(sellingPrice) - Number(costPrice)) /
                  Number(sellingPrice) * 100).toFixed(1)}%)
              </p>
            )}
          </div>

          {/* Branch prices */}
          {branches.length > 1 && (
            <div>
              <label className="text-sm font-semibold">
                Branch Prices (optional)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Override the selling price per branch.
                Leave blank to use the main price.
              </p>
              <div className="space-y-2">
                {branches.map(branch => (
                  <div
                    key={branch.id}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm w-32 truncate">
                      {branch.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={branchPrices[branch.id] ?? ""}
                      onChange={e =>
                        setBranchPrices(prev => ({
                          ...prev,
                          [branch.id]: e.target.value,
                        }))
                      }
                      placeholder={sellingPrice || "0.00"}
                      className="flex-1 rounded-lg border
                        px-3 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="text-sm font-semibold">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={5}
              step={5}
              value={durationMins}
              onChange={e => setDurationMins(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {/* Requirements */}
          <div>
            <label className="text-sm font-semibold">
              Clinical Requirements
            </label>
            <div className="mt-2 space-y-2">
              {[
                {
                  key:   "consent",
                  label: "Requires patient consent form",
                  val:   requiresConsent,
                  set:   setRequiresConsent,
                },
                {
                  key:   "xray",
                  label: "Requires X-ray before procedure",
                  val:   requiresXray,
                  set:   setRequiresXray,
                },
                {
                  key:   "preauth",
                  label: "Requires insurance pre-authorization",
                  val:   requiresPreAuth,
                  set:   setRequiresPreAuth,
                },
                {
                  key:   "booking",
                  label: "Available for online booking",
                  val:   isOnlineBookable,
                  set:   setIsOnlineBookable,
                },
              ].map(item => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.val}
                    onChange={e => item.set(e.target.checked)}
                    className="rounded"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {/* Bill of materials — same modal admins use for pricing/settings */}
          <div className="border-t pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-teal-700" />
              Bill of materials
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              Default consumables to pull for this procedure (prep checklist).
              Changes here save immediately — separate from pricing Save.
            </p>
            <ProcedureBomEditor procedureId={procedure.id} compact />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────

export default function ProcedureCatalogClient({
  procedures:    initialProcedures,
  availableGPMR,
  bundles:       initialBundles,
  categories,
  unpricedCount: initialUnpricedCount,
  currency,
  currencySymbol,
  countryCode,
  taxName,
  branches,
  gpmrTotal,
}: Props) {
  const router                  = useRouter()
  const [isPending, startTransition] = useTransition()

  // Local state
  const [procedures, setProcedures] =
    useState<Procedure[]>(initialProcedures)
  const [bundles, setBundles] =
    useState<Bundle[]>(initialBundles)
  const [unpricedCount, setUnpricedCount] =
    useState(initialUnpricedCount)

  // UI state
  const [activeTab, setActiveTab] =
    useState<"procedures" | "import" | "bundles">("procedures")
  const [searchQuery,     setSearchQuery]     = useState("")
  const [filterCategory,  setFilterCategory]  = useState("ALL")
  const [filterPriced,    setFilterPriced]    =
    useState<"ALL" | "PRICED" | "UNPRICED">("ALL")
  const [expandedCategory, setExpandedCategory] =
    useState<string | null>(null)
  const [editingProcedure, setEditingProcedure] =
    useState<Procedure | null>(null)
  const [bomProcedure, setBomProcedure] = useState<Procedure | null>(null)
  const [selectedGPMR, setSelectedGPMR] =
    useState<Set<string>>(new Set())
  const [importSearch, setImportSearch] = useState("")
  const [importCategory, setImportCategory] = useState("ALL")
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [showAddBundle,  setShowAddBundle]  = useState(false)

  // Custom procedure form
  const [customForm, setCustomForm] = useState({
    name: "", nameAr: "",
    category: "DIAGNOSTIC", durationMins: "30",
    sellingPrice: "", costPrice: "",
    requiresConsent: false,
    requiresXray: false,
    requiresPreAuth: false,
    isOnlineBookable: false,
  })
  const [codePreview, setCodePreview] = useState("")

  // Bundle form
  const [bundleForm, setBundleForm] = useState({
    name: "", description: "",
    bundlePrice: "", durationMins: "60",
    selectedProcedures: [] as string[],
  })

  // Preview auto-generated procedure code when category changes
  useEffect(() => {
    if (!showAddCustom) return
    previewProcedureCode(customForm.category)
      .then(setCodePreview)
      .catch(() => setCodePreview("PRC-…"))
  }, [showAddCustom, customForm.category])

  // ── Filtered procedures ──────────────────────────────────────

  const filteredProcedures = useMemo(() => {
    return procedures.filter(p => {
      if (filterCategory !== "ALL" && p.category !== filterCategory)
        return false
      if (filterPriced === "PRICED"   && !p.isPriced) return false
      if (filterPriced === "UNPRICED" &&  p.isPriced) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.nameAr ?? "").includes(q)
        )
      }
      return true
    })
  }, [procedures, filterCategory, filterPriced, searchQuery])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Procedure[]> = {}
    for (const p of filteredProcedures) {
      if (!groups[p.category]) groups[p.category] = []
      groups[p.category].push(p)
    }
    return groups
  }, [filteredProcedures])

  // ── Filtered GPMR procedures ─────────────────────────────────

  const filteredGPMR = useMemo(() => {
    return availableGPMR.filter(g => {
      if (importCategory !== "ALL" && g.category !== importCategory)
        return false
      if (importSearch) {
        const q = importSearch.toLowerCase()
        return (
          g.localName.toLowerCase().includes(q) ||
          g.gpmrCode.toLowerCase().includes(q)   ||
          g.primaryCode.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [availableGPMR, importCategory, importSearch])

  const gpmrCategories = useMemo(
    () => [...new Set(availableGPMR.map(g => g.category))].sort(),
    [availableGPMR]
  )

  // ── Import from GPMR ─────────────────────────────────────────

  async function handleImport() {
    if (selectedGPMR.size === 0) {
      toast.error("Select at least one procedure to import")
      return
    }

    startTransition(async () => {
      try {
        const result = await importFromGPMR(
          [...selectedGPMR]
        )
        toast.success(
          `${result.imported} procedure${result.imported !== 1 ? "s" : ""} imported. ` +
          `Set selling prices before they can be invoiced.`
        )
        setSelectedGPMR(new Set())
        setUnpricedCount(prev => prev + result.imported)
        router.refresh()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Import failed"
        toast.error(message)
      }
    })
  }

  // ── Create custom procedure ──────────────────────────────────

  async function handleCreateCustom() {
    if (!customForm.name) {
      toast.error("Name is required")
      return
    }
    startTransition(async () => {
      try {
        const { code } = await createCustomProcedure({
          name:         customForm.name.trim(),
          nameAr:       customForm.nameAr.trim() || undefined,
          category:     customForm.category,
          durationMins: Number(customForm.durationMins) || 30,
          sellingPrice: parseOptionalPrice(customForm.sellingPrice),
          costPrice:    parseOptionalPrice(customForm.costPrice),
          requiresConsent:  customForm.requiresConsent,
          requiresXray:     customForm.requiresXray,
          requiresPreAuth:  customForm.requiresPreAuth,
          isOnlineBookable: customForm.isOnlineBookable,
        })
        toast.success(`Custom procedure created (${code})`)
        setShowAddCustom(false)
        setCustomForm({
          name: "", nameAr: "",
          category: "DIAGNOSTIC", durationMins: "30",
          sellingPrice: "", costPrice: "",
          requiresConsent: false,
          requiresXray: false,
          requiresPreAuth: false,
          isOnlineBookable: false,
        })
        setCodePreview("")
        router.refresh()
      } catch (err: unknown) {
        toast.error(messageFromActionError(err))
      }
    })
  }

  // ── Toggle active ────────────────────────────────────────────

  async function handleToggleActive(
    procedureId: string,
    isActive: boolean
  ) {
    startTransition(async () => {
      try {
        await toggleProcedureActive(procedureId, isActive)
        router.refresh()
      } catch (err: unknown) {
        toast.error(messageFromActionError(err))
      }
    })
  }

  // ── Create bundle ────────────────────────────────────────────

  async function handleCreateBundle() {
    if (!bundleForm.name) {
      toast.error("Bundle name is required")
      return
    }
    if (bundleForm.selectedProcedures.length < 2) {
      toast.error("Select at least 2 procedures for a bundle")
      return
    }
    startTransition(async () => {
      try {
        await createBundle({
          name:        bundleForm.name,
          description: bundleForm.description || undefined,
          bundlePrice: bundleForm.bundlePrice
            ? Number(bundleForm.bundlePrice) : null,
          durationMins: Number(bundleForm.durationMins) || 60,
          items: bundleForm.selectedProcedures.map((id, i) => ({
            procedureCatalogId: id,
            displayOrder: i,
          })),
        })
        toast.success("Bundle created")
        setShowAddBundle(false)
        setBundleForm({
          name: "", description: "",
          bundlePrice: "", durationMins: "60",
          selectedProcedures: [],
        })
        router.refresh()
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to create bundle"
        toast.error(message)
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Unpriced warning banner */}
      {unpricedCount > 0 && activeTab === "procedures" && (
        <div className="bg-orange-50 border border-orange-200
          rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500
              flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800 text-sm">
                {unpricedCount} procedure
                {unpricedCount !== 1 ? "s" : ""} not yet priced
              </p>
              <p className="text-orange-700 text-xs mt-0.5">
                These cannot be added to invoices until a selling
                price is set. Click ⚙ on any procedure to set its price.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterPriced("UNPRICED")}
            className="text-xs font-medium text-orange-700
              underline flex-shrink-0 hover:text-orange-900"
          >
            Show unpriced →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "procedures", label: "My Procedures",
            icon: <BookOpen className="w-4 h-4" />,
            badge: procedures.length },
          { key: "import",     label: "Import from Library",
            icon: <Plus className="w-4 h-4" />,
            badge: availableGPMR.length },
          { key: "bundles",    label: "Bundles",
            icon: <Layers className="w-4 h-4" />,
            badge: bundles.length },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm
              font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full
              font-semibold ${
              activeTab === tab.key
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}>
              {tab.badge}
            </span>
          </button>
        ))}
      </div>

      {/* ── TAB: MY PROCEDURES ─────────────────────────────── */}
      {activeTab === "procedures" && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center
            justify-between">
            <div className="flex gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2
                  -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search procedures..."
                  className="pl-9 pr-3 py-2 rounded-lg border text-sm
                    w-52"
                />
              </div>

              {/* Category filter */}
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm bg-white"
              >
                <option value="ALL">All categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Priced filter */}
              <select
                value={filterPriced}
                onChange={e =>
                  setFilterPriced(
                    e.target.value as "ALL" | "PRICED" | "UNPRICED",
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm bg-white"
              >
                <option value="ALL">All statuses</option>
                <option value="PRICED">Priced only</option>
                <option value="UNPRICED">⚠ Not priced</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddCustom(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add custom
              </Button>
              <Button
                size="sm"
                onClick={() => setActiveTab("import")}
              >
                <BookOpen className="w-4 h-4 mr-1" />
                Import from library
              </Button>
            </div>
          </div>

          {/* Procedure groups */}
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="font-medium">No procedures yet</p>
              <p className="text-sm mt-1">
                Import from the global library or add a custom procedure
              </p>
              <Button
                className="mt-4"
                onClick={() => setActiveTab("import")}
              >
                Import procedures
              </Button>
            </div>
          ) : (
            Object.entries(grouped).map(([category, procs]) => (
              <div key={category}
                className="border rounded-xl overflow-hidden">

                {/* Category header */}
                <button
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === category ? null : category
                    )
                  }
                  className="w-full flex items-center justify-between
                    px-4 py-3 bg-gray-50 hover:bg-gray-100
                    transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5
                      rounded-full ${
                      CATEGORY_COLORS[category] ??
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {category}
                    </span>
                    <span className="text-sm font-medium">
                      {procs.length} procedure
                      {procs.length !== 1 ? "s" : ""}
                    </span>
                    {procs.some(p => !p.isPriced) && (
                      <span className="text-xs text-orange-600
                        font-medium">
                        ⚠ {procs.filter(p => !p.isPriced).length} unpriced
                      </span>
                    )}
                  </div>
                  {expandedCategory === category
                    ? <ChevronUp className="w-4 h-4" />
                    : <ChevronDown className="w-4 h-4" />
                  }
                </button>

                {/* Procedures table */}
                {expandedCategory === category && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50">
                        <th className="text-left px-4 py-2
                          text-xs font-semibold text-muted-foreground">
                          Code
                        </th>
                        <th className="text-left px-4 py-2
                          text-xs font-semibold text-muted-foreground">
                          Procedure
                        </th>
                        <th className="text-left px-4 py-2
                          text-xs font-semibold text-muted-foreground">
                          Duration
                        </th>
                        <th className="text-left px-4 py-2
                          text-xs font-semibold text-muted-foreground">
                          Cost
                        </th>
                        <th className="text-left px-4 py-2
                          text-xs font-semibold text-muted-foreground">
                          Selling price
                        </th>
                        <th className="text-left px-4 py-2
                          text-xs font-semibold text-muted-foreground">
                          Margin
                        </th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {procs.map(proc => (
                        <tr key={proc.id}
                          className={`border-b last:border-0
                            hover:bg-gray-50 ${
                            !proc.isActive ? "opacity-50" : ""
                          }`}>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs
                              bg-gray-100 px-1.5 py-0.5 rounded">
                              {proc.code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{proc.name}</p>
                              {proc.nameAr && (
                                <p className="text-xs
                                  text-muted-foreground" dir="rtl">
                                  {proc.nameAr}
                                </p>
                              )}
                              <div className="flex gap-1 mt-0.5">
                                {proc.isFromGPMR && (
                                  <span className="text-[10px]
                                    bg-blue-50 text-blue-600
                                    border border-blue-200
                                    px-1 rounded">
                                    GPMR
                                  </span>
                                )}
                                {proc.requiresConsent && (
                                  <span className="text-[10px]
                                    bg-purple-50 text-purple-600
                                    border border-purple-200
                                    px-1 rounded">
                                    consent
                                  </span>
                                )}
                                {proc.requiresPreAuth && (
                                  <span className="text-[10px]
                                    bg-orange-50 text-orange-600
                                    border border-orange-200
                                    px-1 rounded">
                                    pre-auth
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm
                            text-muted-foreground">
                            {proc.durationMins} min
                          </td>
                          <td className="px-4 py-3 text-sm
                            text-muted-foreground">
                            {proc.costPrice !== null
                              ? `${currencySymbol} ${proc.costPrice.toFixed(2)}`
                              : "—"
                            }
                          </td>
                          <td className="px-4 py-3">
                            {proc.isPriced ? (
                              <span className="font-semibold
                                text-green-700">
                                {currencySymbol}{" "}
                                {proc.sellingPrice!.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-orange-600
                                text-xs font-medium flex items-center
                                gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Not priced
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm
                            text-muted-foreground">
                            {proc.marginPct
                              ? `${proc.marginPct}%`
                              : "—"
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  setEditingProcedure(proc)
                                }
                                className="p-1.5 hover:bg-gray-100
                                  rounded-lg transition-colors"
                                title="Edit pricing & settings"
                              >
                                <Settings2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setBomProcedure(proc)}
                                className="inline-flex items-center gap-1 rounded-lg
                                  border px-2 py-1 text-xs font-medium
                                  text-teal-800 hover:bg-teal-50
                                  transition-colors"
                                title="Bill of materials"
                              >
                                <Package className="w-3.5 h-3.5" />
                                BoM
                              </button>
                              <button
                                onClick={() =>
                                  handleToggleActive(
                                    proc.id,
                                    !proc.isActive
                                  )
                                }
                                className={`text-xs px-2 py-1
                                  rounded-lg border transition-colors ${
                                  proc.isActive
                                    ? "text-gray-500 hover:bg-gray-50"
                                    : "text-green-600 border-green-200 hover:bg-green-50"
                                }`}
                              >
                                {proc.isActive ? "Disable" : "Enable"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: IMPORT FROM LIBRARY ────────────────────────── */}
      {activeTab === "import" && (
        <div className="space-y-4">

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200
            rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800">
              🌐 Global Procedure Library
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {gpmrTotal} procedures available globally.{" "}
              {availableGPMR.length} not yet imported
              for your clinic.
              Procedures are imported with{" "}
              <strong>no selling price</strong> — you set
              all prices after import.
            </p>
          </div>

          {/* Filters + search */}
          <div className="flex gap-3 flex-wrap items-center
            justify-between">
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2
                  -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                <input
                  value={importSearch}
                  onChange={e => setImportSearch(e.target.value)}
                  placeholder="Search library..."
                  className="pl-9 pr-3 py-2 rounded-lg border
                    text-sm w-52"
                />
              </div>
              <select
                value={importCategory}
                onChange={e => setImportCategory(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm
                  bg-white"
              >
                <option value="ALL">All categories</option>
                {gpmrCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {selectedGPMR.size > 0 && (
              <Button
                onClick={handleImport}
                disabled={isPending}
              >
                {isPending
                  ? "Importing..."
                  : `Import selected (${selectedGPMR.size})`
                }
              </Button>
            )}
          </div>

          {/* Select all / none */}
          {filteredGPMR.length > 0 && (
            <div className="flex gap-3 text-xs">
              <button
                onClick={() =>
                  setSelectedGPMR(
                    new Set(filteredGPMR.map(g => g.id))
                  )
                }
                className="text-blue-600 hover:underline"
              >
                Select all ({filteredGPMR.length})
              </button>
              {selectedGPMR.size > 0 && (
                <button
                  onClick={() => setSelectedGPMR(new Set())}
                  className="text-muted-foreground hover:underline"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}

          {/* GPMR procedure list */}
          {filteredGPMR.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2
                text-green-400" />
              <p className="font-medium">All procedures imported</p>
              <p className="text-sm">
                All available procedures are already in your catalog
              </p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-2 w-8" />
                    <th className="text-left px-4 py-2 text-xs
                      font-semibold text-muted-foreground">
                      Code
                    </th>
                    <th className="text-left px-4 py-2 text-xs
                      font-semibold text-muted-foreground">
                      Procedure
                    </th>
                    <th className="text-left px-4 py-2 text-xs
                      font-semibold text-muted-foreground">
                      Category
                    </th>
                    <th className="text-left px-4 py-2 text-xs
                      font-semibold text-muted-foreground">
                      Duration
                    </th>
                    <th className="text-left px-4 py-2 text-xs
                      font-semibold text-muted-foreground">
                      Country codes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGPMR.map(g => (
                    <tr key={g.id}
                      className={`border-b last:border-0
                        hover:bg-gray-50 cursor-pointer ${
                        selectedGPMR.has(g.id)
                          ? "bg-blue-50"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedGPMR(prev => {
                          const next = new Set(prev)
                          next.has(g.id)
                            ? next.delete(g.id)
                            : next.add(g.id)
                          return next
                        })
                      }
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedGPMR.has(g.id)}
                          onChange={() => {}}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs
                          bg-gray-100 px-1.5 py-0.5 rounded">
                          {g.primaryCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{g.localName}</p>
                        {g.localNameAr && (
                          <p className="text-xs text-muted-foreground"
                            dir="rtl">
                            {g.localNameAr}
                          </p>
                        )}
                        <span className="text-[10px]
                          text-muted-foreground">
                          {g.gpmrCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium
                          px-2 py-0.5 rounded-full ${
                          CATEGORY_COLORS[g.category] ??
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {g.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {g.durationMins} min
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(g.localCodes)
                            .slice(0, 3)
                            .map(([sys, code]) => (
                            <span key={sys}
                              className="text-[10px] bg-gray-100
                                text-gray-600 px-1.5 py-0.5 rounded
                                font-mono">
                              {sys}: {code}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Import button (bottom) */}
          {selectedGPMR.size > 0 && (
            <div className="flex justify-end">
              <Button
                onClick={handleImport}
                disabled={isPending}
                size="lg"
              >
                {isPending
                  ? "Importing..."
                  : `Import ${selectedGPMR.size} procedure${
                      selectedGPMR.size !== 1 ? "s" : ""
                    }`
                }
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: BUNDLES ────────────────────────────────────── */}
      {activeTab === "bundles" && (
        <div className="space-y-4">

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Bundle multiple procedures into a package.
                Set your own bundle price — may be less than
                the sum of individual procedures.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddBundle(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              New bundle
            </Button>
          </div>

          {bundles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground
              border rounded-xl">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30"/>
              <p className="font-medium">No bundles yet</p>
              <p className="text-sm">
                Create a bundle to offer procedure packages
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bundles.map(bundle => (
                <div key={bundle.id}
                  className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{bundle.name}</p>
                      {bundle.description && (
                        <p className="text-xs text-muted-foreground
                          mt-0.5">
                          {bundle.description}
                        </p>
                      )}
                    </div>
                    {bundle.bundlePrice !== null ? (
                      <div className="text-right">
                        <p className="font-bold text-green-700">
                          {currencySymbol}{" "}
                          {bundle.bundlePrice.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bundle.currency}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-orange-600
                        font-medium">
                        ⚠ No price set
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {bundle.items.length} procedure
                    {bundle.items.length !== 1 ? "s" : ""}
                    {" · "}
                    {bundle.durationMins} min total
                    {bundle.isOnlineBookable && " · Online bookable"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT PRICING PANEL ──────────────────────────────── */}
      {editingProcedure && (
        <EditPricingPanel
          procedure={editingProcedure}
          currency={currency}
          currencySymbol={currencySymbol}
          branches={branches}
          onSave={() => {
            router.refresh()
          }}
          onClose={() => setEditingProcedure(null)}
        />
      )}

      {bomProcedure && (
        <ProcedureBomPanel
          procedureId={bomProcedure.id}
          procedureCode={bomProcedure.code}
          procedureName={bomProcedure.name}
          onClose={() => setBomProcedure(null)}
        />
      )}

      {/* ── ADD CUSTOM PROCEDURE MODAL ───────────────────────── */}
      {showAddCustom && (
        <div className="fixed inset-0 z-50 flex items-center
          justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowAddCustom(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl
            w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="font-bold text-lg">Add Custom Procedure</h2>
            <p className="text-xs text-muted-foreground">
              Create a procedure specific to your clinic.
              Not linked to the global library.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">
                  Procedure code
                </label>
                <div
                  className="mt-1 w-full rounded-lg border bg-muted/40 px-3 py-2
                    text-sm font-mono text-muted-foreground"
                >
                  {codePreview || "Select category…"}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Auto-generated on save
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={customForm.category}
                  onChange={e =>
                    setCustomForm(p =>
                      ({...p, category: e.target.value})
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2
                    text-sm bg-white"
                >
                  {[
                    "DIAGNOSTIC","PREVENTIVE","RESTORATIVE",
                    "ENDODONTICS","PERIODONTICS","ORAL_SURGERY",
                    "PROSTHODONTICS","IMPLANTOLOGY","ORTHODONTICS",
                    "COSMETIC","PAEDIATRIC","EMERGENCY",
                    "ANAESTHESIA","APPLIANCES","OTHER",
                  ].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">
                Name (English) <span className="text-red-500">*</span>
              </label>
              <input
                value={customForm.name}
                onChange={e =>
                  setCustomForm(p => ({...p, name: e.target.value}))
                }
                placeholder="Procedure name"
                className="mt-1 w-full rounded-lg border px-3 py-2
                  text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                Name (Arabic) — optional
              </label>
              <input
                value={customForm.nameAr}
                onChange={e =>
                  setCustomForm(p =>
                    ({...p, nameAr: e.target.value})
                  )
                }
                placeholder="اسم الإجراء"
                dir="rtl"
                className="mt-1 w-full rounded-lg border px-3 py-2
                  text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={customForm.durationMins}
                  onChange={e =>
                    setCustomForm(p =>
                      ({...p, durationMins: e.target.value})
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2
                    text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">
                  Cost ({currencySymbol})
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={customForm.costPrice}
                  onChange={e =>
                    setCustomForm(p =>
                      ({...p, costPrice: e.target.value})
                    )
                  }
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border px-3 py-2
                    text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">
                  Selling ({currencySymbol})
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={customForm.sellingPrice}
                  onChange={e =>
                    setCustomForm(p =>
                      ({...p, sellingPrice: e.target.value})
                    )
                  }
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border px-3 py-2
                    text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">
                Clinical requirements
              </label>
              <div className="mt-2 space-y-2">
                {[
                  {
                    key: "consent",
                    label: "Requires patient consent form",
                    val: customForm.requiresConsent,
                    field: "requiresConsent" as const,
                  },
                  {
                    key: "xray",
                    label: "Requires X-ray before procedure",
                    val: customForm.requiresXray,
                    field: "requiresXray" as const,
                  },
                  {
                    key: "preauth",
                    label: "Requires insurance pre-authorization",
                    val: customForm.requiresPreAuth,
                    field: "requiresPreAuth" as const,
                  },
                  {
                    key: "booking",
                    label: "Available for online booking",
                    val: customForm.isOnlineBookable,
                    field: "isOnlineBookable" as const,
                  },
                ].map(item => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.val}
                      onChange={e =>
                        setCustomForm(p => ({
                          ...p,
                          [item.field]: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddCustom(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCustom}
                disabled={isPending}
              >
                {isPending ? "Creating..." : "Create procedure"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD BUNDLE MODAL ─────────────────────────────────── */}
      {showAddBundle && (
        <div className="fixed inset-0 z-50 flex items-center
          justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowAddBundle(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl
            w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh]
            overflow-y-auto">
            <h2 className="font-bold text-lg">Create Bundle</h2>

            <div>
              <label className="text-xs font-medium">
                Bundle name <span className="text-red-500">*</span>
              </label>
              <input
                value={bundleForm.name}
                onChange={e =>
                  setBundleForm(p => ({...p, name: e.target.value}))
                }
                placeholder="e.g. New Patient Welcome Package"
                className="mt-1 w-full rounded-lg border px-3 py-2
                  text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                Description (optional)
              </label>
              <textarea
                value={bundleForm.description}
                onChange={e =>
                  setBundleForm(p =>
                    ({...p, description: e.target.value})
                  )
                }
                placeholder="What's included in this bundle?"
                rows={2}
                className="mt-1 w-full rounded-lg border px-3 py-2
                  text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">
                  Bundle price ({currencySymbol})
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={bundleForm.bundlePrice}
                  onChange={e =>
                    setBundleForm(p =>
                      ({...p, bundlePrice: e.target.value})
                    )
                  }
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border px-3 py-2
                    text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Leave blank to price later
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">
                  Total duration (min)
                </label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={bundleForm.durationMins}
                  onChange={e =>
                    setBundleForm(p =>
                      ({...p, durationMins: e.target.value})
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2
                    text-sm"
                />
              </div>
            </div>

            {/* Select procedures for bundle */}
            <div>
              <label className="text-xs font-medium">
                Include procedures{" "}
                <span className="text-red-500">*</span>
                <span className="text-muted-foreground ml-1">
                  (select 2 or more)
                </span>
              </label>
              <div className="mt-2 border rounded-lg max-h-48
                overflow-y-auto">
                {procedures
                  .filter(p => p.isActive && p.canBundle)
                  .map(proc => (
                  <label
                    key={proc.id}
                    className={`flex items-center gap-3 px-3 py-2
                      text-sm cursor-pointer hover:bg-gray-50
                      border-b last:border-0 ${
                      bundleForm.selectedProcedures.includes(proc.id)
                        ? "bg-blue-50"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={bundleForm.selectedProcedures
                        .includes(proc.id)}
                      onChange={e => {
                        setBundleForm(p => ({
                          ...p,
                          selectedProcedures: e.target.checked
                            ? [...p.selectedProcedures, proc.id]
                            : p.selectedProcedures.filter(
                                id => id !== proc.id
                              ),
                        }))
                      }}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{proc.name}</span>
                      <span className="text-muted-foreground ml-2
                        text-xs">
                        {proc.durationMins} min
                        {proc.sellingPrice !== null &&
                          ` · ${currencySymbol} ${proc.sellingPrice.toFixed(2)}`
                        }
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddBundle(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBundle}
                disabled={isPending}
              >
                {isPending ? "Creating..." : "Create bundle"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}