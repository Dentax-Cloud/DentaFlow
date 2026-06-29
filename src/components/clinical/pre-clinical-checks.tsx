"use client"
// ============================================================
// Pre-Clinical Checks Component
// Shows contraindication warnings before a procedure starts
// Used in chairside when doctor selects a procedure
// Blocks if BLOCK severity — warns if WARN severity
// ============================================================

import { useState, useEffect, useCallback } from "react"
import { XCircle, AlertTriangle, Info, CheckCircle } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────

type CheckType = "BLOCK" | "WARN" | "INFO"

type PreClinicalCheck = {
  type:        CheckType
  code:        string
  message:     string
  canOverride: boolean
}

type CheckSummary = {
  total:      number
  blocks:     number
  warnings:   number
  infos:      number
  canProceed: boolean
}

type Props = {
  procedureId:       string
  patientId:         string
  procedureName?:    string
  onChecksComplete:  (canProceed: boolean) => void
  onDismiss?:        () => void
}

// ── Check type config ─────────────────────────────────────────

const CHECK_CONFIG = {
  BLOCK: {
    icon:       XCircle,
    iconClass:  "text-red-500",
    bgClass:    "bg-red-50 border-red-300",
    titleClass: "text-red-800",
    bodyClass:  "text-red-700",
    label:      "⛔ Cannot proceed",
    borderLeft: "border-l-4 border-l-red-500",
  },
  WARN: {
    icon:       AlertTriangle,
    iconClass:  "text-orange-500",
    bgClass:    "bg-orange-50 border-orange-300",
    titleClass: "text-orange-800",
    bodyClass:  "text-orange-700",
    label:      "⚠ Warning",
    borderLeft: "border-l-4 border-l-orange-400",
  },
  INFO: {
    icon:       Info,
    iconClass:  "text-blue-500",
    bgClass:    "bg-blue-50 border-blue-200",
    titleClass: "text-blue-800",
    bodyClass:  "text-blue-700",
    label:      "ℹ Information",
    borderLeft: "border-l-4 border-l-blue-400",
  },
}

// ── Skeleton loader ───────────────────────────────────────────

function CheckSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2].map(i => (
        <div
          key={i}
          className="h-20 bg-gray-100 rounded-xl border"
        />
      ))}
    </div>
  )
}

// ── Individual check card ─────────────────────────────────────

function CheckCard({
  check,
  isAcknowledged,
  onAcknowledge,
}: {
  check:          PreClinicalCheck
  isAcknowledged: boolean
  onAcknowledge:  () => void
}) {
  const cfg  = CHECK_CONFIG[check.type]
  const Icon = cfg.icon

  return (
    <div
      className={`rounded-xl border p-4 transition-opacity
        ${cfg.bgClass} ${cfg.borderLeft}
        ${isAcknowledged ? "opacity-50" : "opacity-100"}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <Icon
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconClass}`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold uppercase tracking-wide
            mb-1 ${cfg.titleClass}`}>
            {cfg.label}
          </p>
          <p className={`text-sm leading-relaxed ${cfg.bodyClass}`}>
            {check.message}
          </p>

          {/* Acknowledge button */}
          {check.canOverride && !isAcknowledged && (
            <button
              onClick={onAcknowledge}
              className="mt-2 text-xs font-medium underline
                text-muted-foreground hover:text-foreground
                transition-colors"
            >
              I acknowledge this — proceed anyway
            </button>
          )}

          {/* Acknowledged indicator */}
          {isAcknowledged && (
            <div className="mt-2 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <p className="text-xs text-green-700 font-medium">
                Acknowledged by clinician
              </p>
            </div>
          )}

          {/* Hard block indicator */}
          {check.type === "BLOCK" && !check.canOverride && (
            <p className="mt-2 text-xs text-red-600 font-semibold">
              This block cannot be overridden.
              Resolve the clinical issue before proceeding.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export function PreClinicalChecks({
  procedureId,
  patientId,
  procedureName,
  onChecksComplete,
  onDismiss,
}: Props) {
  const [checks,   setChecks]   = useState<PreClinicalCheck[]>([])
  const [summary,  setSummary]  = useState<CheckSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState<Set<string>>(
    new Set()
  )

  // ── Fetch checks ───────────────────────────────────────────

  const fetchChecks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/clinical/pre-checks` +
        `?procedureId=${encodeURIComponent(procedureId)}` +
        `&patientId=${encodeURIComponent(patientId)}`
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to load checks")
      }

      const data = await res.json()
      setChecks(data.checks    ?? [])
      setSummary(data.summary  ?? null)

      // If no checks at all — auto proceed
      if (!data.checks || data.checks.length === 0) {
        onChecksComplete(true)
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load pre-clinical checks")
    } finally {
      setLoading(false)
    }
  }, [procedureId, patientId, onChecksComplete])

  useEffect(() => {
    fetchChecks()
  }, [fetchChecks])

  // ── Derived state ──────────────────────────────────────────

  const hasUnresolvedBlocks = checks.some(
    c => c.type === "BLOCK" && !c.canOverride
  )

  const hasUnacknowledgedWarnings = checks
    .filter(c => c.type === "WARN" || (c.type === "BLOCK" && c.canOverride))
    .some(c => !acknowledged.has(c.code))

  const canProceedNow =
    !hasUnresolvedBlocks && !hasUnacknowledgedWarnings

  // ── Handle acknowledge ─────────────────────────────────────

  function handleAcknowledge(code: string) {
    setAcknowledged(prev => new Set([...prev, code]))
  }

  function handleAcknowledgeAll() {
    const allOverridable = checks
      .filter(c => c.canOverride)
      .map(c => c.code)
    setAcknowledged(new Set(allOverridable))
  }

  // ── Render loading ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm
          text-muted-foreground">
          <div className="w-4 h-4 border-2 border-blue-500
            border-t-transparent rounded-full animate-spin" />
          Checking patient safety profile...
        </div>
        <CheckSkeleton />
      </div>
    )
  }

  // ── Render error ───────────────────────────────────────────

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200
        rounded-xl p-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              Failed to load safety checks
            </p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={fetchChecks}
            className="text-xs font-medium text-red-700
              underline hover:text-red-900"
          >
            Retry
          </button>
          <button
            onClick={() => onChecksComplete(true)}
            className="text-xs font-medium text-muted-foreground
              underline hover:text-foreground"
          >
            Skip checks and proceed
          </button>
        </div>
      </div>
    )
  }

  // ── No checks — nothing to show ───────────────────────────

  if (checks.length === 0) return null

  // ── Render checks ──────────────────────────────────────────

  const blocks   = checks.filter(c => c.type === "BLOCK")
  const warnings = checks.filter(c => c.type === "WARN")
  const infos    = checks.filter(c => c.type === "INFO")

  const overridableWarnings = [
    ...blocks.filter(c => c.canOverride),
    ...warnings,
  ]
  const unacknowledgedCount = overridableWarnings.filter(
    c => !acknowledged.has(c.code)
  ).length

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">
            Pre-Clinical Safety Check
          </h3>
          {procedureName && (
            <p className="text-xs text-muted-foreground">
              {procedureName}
            </p>
          )}
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-1.5">
          {blocks.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5
              rounded-full bg-red-100 text-red-700">
              {blocks.length} block{blocks.length !== 1 ? "s" : ""}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5
              rounded-full bg-orange-100 text-orange-700">
              {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
            </span>
          )}
          {infos.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5
              rounded-full bg-blue-100 text-blue-700">
              {infos.length} info
            </span>
          )}
        </div>
      </div>

      {/* Blocks first */}
      {blocks.map(check => (
        <CheckCard
          key={check.code}
          check={check}
          isAcknowledged={acknowledged.has(check.code)}
          onAcknowledge={() => handleAcknowledge(check.code)}
        />
      ))}

      {/* Warnings */}
      {warnings.map(check => (
        <CheckCard
          key={check.code}
          check={check}
          isAcknowledged={acknowledged.has(check.code)}
          onAcknowledge={() => handleAcknowledge(check.code)}
        />
      ))}

      {/* Info items */}
      {infos.map(check => (
        <CheckCard
          key={check.code}
          check={check}
          isAcknowledged={acknowledged.has(check.code)}
          onAcknowledge={() => handleAcknowledge(check.code)}
        />
      ))}

      {/* Acknowledge all button */}
      {unacknowledgedCount > 1 && (
        <button
          onClick={handleAcknowledgeAll}
          className="text-xs font-medium text-muted-foreground
            underline hover:text-foreground w-full text-center
            py-1"
        >
          Acknowledge all {unacknowledgedCount} warnings
        </button>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">

        {/* Dismiss / go back */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-1 py-2 border rounded-lg text-sm
              text-muted-foreground hover:bg-gray-50
              transition-colors"
          >
            ← Go back
          </button>
        )}

        {/* Proceed button */}
        <button
          onClick={() => onChecksComplete(canProceedNow)}
          disabled={hasUnresolvedBlocks}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold
            transition-colors ${
            hasUnresolvedBlocks
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : canProceedNow
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
          }`}
        >
          {hasUnresolvedBlocks
            ? "⛔ Cannot proceed — resolve block first"
            : canProceedNow
            ? "✓ Proceed with procedure"
            : `Acknowledge ${unacknowledgedCount} warning${
                unacknowledgedCount !== 1 ? "s" : ""
              } to proceed`
          }
        </button>
      </div>

      {/* Hard block explanation */}
      {hasUnresolvedBlocks && (
        <p className="text-xs text-red-600 text-center">
          One or more critical contraindications must be
          resolved before this procedure can be performed.
          Please review the patient&apos;s medical history
          or consult a senior clinician.
        </p>
      )}
    </div>
  )
}

export default PreClinicalChecks