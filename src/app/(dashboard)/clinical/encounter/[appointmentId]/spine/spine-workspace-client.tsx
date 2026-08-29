"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EncounterGateSummary } from "@/components/clinical/encounter-gate-summary";
import type { GateChipStatus } from "@/components/clinical/gate-status-chip";
import {
  LEGAL_FORWARD_TRANSITIONS,
  INTERRUPTIBLE_STATUSES,
  type InterruptOutcome,
} from "@/lib/encounter/state-machine";
import type { EncounterStatus, EncounterProcedureLineStatus } from "@/lib/encounter/types";
import type { GateSummary } from "@/lib/encounter/types";
import { isVerificationStale } from "@/lib/encounter/gates";
import type {
  SpineCatalogSnippet,
  SpineEncounterSerialized,
  SpineInventorySnippet,
  SpineWorkspaceData,
} from "@/app/(dashboard)/features/clinical/encounter-spine-actions";
import {
  transitionSpineEncounter,
  interruptSpineEncounter,
  resolveSpineInterrupt,
  clearSpineRisk,
  grantSpineConsent,
  upsertSpineInsuranceVerification,
  overrideSpinePreAuth,
  addSpineProcedureLine,
  transitionSpineProcedureLine,
  logSpineSterilization,
  logSpineMaterial,
  listSpineFefoLots,
  returnSpineMaterial,
  recordSpinePainScore,
  advanceSpinePastGates,
  closeAndInvoiceSpineEncounter,
  loadSpineWorkspaceData,
  scheduleSpineRecall,
  saveSpineCloseOutNote,
  completeSpineExam,
  recordSpineNursePresence,
  createVisitShareLink,
  setImagePatientShareable,
} from "@/app/(dashboard)/features/clinical/encounter-spine-actions";
import { NURSE_PRESENCE_STAGES } from "@/lib/encounter/types";
import { isAnaesthesiaOrSedationCategory } from "@/lib/encounter/anaesthesia";
import { AnaesthesiaCosignDialog } from "./anaesthesia-cosign-dialog";
import { findPrescriptionAllergyConflicts } from "@/lib/encounter/close-out";
import { PreClinicalChecks } from "@/components/clinical/pre-clinical-checks";
import { ImageGallery } from "@/components/clinical/image-gallery";
import { buildSpineBillingPreview } from "@/lib/encounter/billing-preview";
import { lotExpiryWarning, type InventoryLotSuggestion } from "@/lib/inventory/lots";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import type { PerioMeasurement } from "@/lib/clinical/types";
import {
  SpineStageNav,
  statusToNavStage,
  type SpineNavPanelId,
  type SpineToolId,
} from "./spine-stage-nav";
import { SpineStageCard } from "./spine-stage-card";
import { SpineClinicalFindings } from "./spine-clinical-findings";
import { SpineBillingDrawer, type SpinePendingPriceRow } from "./spine-billing-drawer";
import { SpineToolOverlay } from "./spine-tool-overlay";
import { insuranceDraftFromVerification } from "@/lib/encounter/insurance-draft";

type DraftState = {
  asaClass: string;
  insuranceEligibility: string;
  insurancePreAuth: string;
  estimatedCoverage: string;
  estimatedCopay: string;
  overrideReason: string;
  patientAck: boolean;
  incidentNote: string;
  painScore: string;
  painNextAction: string;
  catalogId: string;
  materialLineId: string;
  materialItemId: string;
  materialTier: "tracked" | "consumable";
  materialQty: string;
  materialLot: string;
  materialExpiry: string;
  materialBillable: boolean;
  prescriptionText: string;
  closeOutNote: string;
  ackAllergyConflict: boolean;
  recallMonths: string;
  chiefComplaint: string;
  findings: string;
  provisionalDiagnosis: string;
};

const EMPTY_DRAFT: DraftState = {
  asaClass: "",
  insuranceEligibility: "eligible",
  insurancePreAuth: "not_required",
  estimatedCoverage: "",
  estimatedCopay: "",
  overrideReason: "",
  patientAck: false,
  incidentNote: "",
  painScore: "",
  painNextAction: "",
  catalogId: "",
  materialLineId: "",
  materialItemId: "",
  materialTier: "consumable",
  materialQty: "1",
  materialLot: "",
  materialExpiry: "",
  materialBillable: true,
  prescriptionText: "",
  closeOutNote: "",
  ackAllergyConflict: false,
  recallMonths: "6",
  chiefComplaint: "",
  findings: "",
  provisionalDiagnosis: "",
};

function draftKey(encounterId: string) {
  return `dentaflow:spine-draft:${encounterId}`;
}

function statusLabel(value: string | undefined | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").toUpperCase();
}

function formatTime(iso: string | null | undefined, mounted: boolean) {
  if (!iso || !mounted) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const btn =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btn} bg-teal-800 text-white hover:bg-teal-900`;
const btnSecondary = `${btn} bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50`;
const btnDanger = `${btn} bg-rose-700 text-white hover:bg-rose-800`;
const field =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-slate-500";

export function SpineWorkspaceClient({
  appointmentId,
  canWrite,
  canAssist = false,
  canWriteInsurance = false,
  initial,
}: {
  appointmentId: string;
  canWrite: boolean;
  canAssist?: boolean;
  /** Approve/edit insurance verification — insurance.write only (not clinical write). */
  canWriteInsurance?: boolean;
  initial: SpineWorkspaceData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hasMounted, setHasMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [encounter, setEncounter] = useState<SpineEncounterSerialized>(initial.encounter);
  const [gates, setGates] = useState<GateSummary>(initial.gates);
  const [clinicalFindings, setClinicalFindings] = useState(initial.clinicalFindings);
  const [visitShareUrl, setVisitShareUrl] = useState<string | null>(null);
  const [cosignLine, setCosignLine] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [procedures] = useState<SpineCatalogSnippet[]>(initial.procedures);
  const [inventoryItems] = useState<SpineInventorySnippet[]>(initial.inventoryItems);
  const [bomByProcedureId] = useState(initial.bomByProcedureId ?? {});
  const [preCheckOk, setPreCheckOk] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<SpineNavPanelId>(() =>
    statusToNavStage(initial.encounter.status),
  );
  const [overlayTool, setOverlayTool] = useState<SpineToolId | null>(null);
  const [focusTooth, setFocusTooth] = useState<string | undefined>();
  const [fefoLots, setFefoLots] = useState<InventoryLotSuggestion[]>([]);
  const [fefoLoading, setFefoLoading] = useState(false);
  const [draft, setDraft] = useState<DraftState>(() => ({
    ...EMPTY_DRAFT,
    asaClass: initial.encounter.riskAssessments[0]?.asaClass ?? "",
    ...insuranceDraftFromVerification(initial.encounter.insuranceVerifications[0]),
    painScore:
      initial.encounter.painScore != null ? String(initial.encounter.painScore) : "",
    painNextAction: initial.encounter.painNextAction ?? "",
    catalogId: "",
    materialItemId: "",
  }));

  useEffect(() => {
    setHasMounted(true);
    // Narrow screens: collapse drawer by default (match after mount to avoid hydration mismatch).
    try {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
        setDrawerOpen(false);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setActivePanel(statusToNavStage(encounter.status));
  }, [encounter.status]);

  useEffect(() => {
    if (!hasMounted || !encounter.id) return;
    try {
      const raw = localStorage.getItem(draftKey(encounter.id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DraftState>;
      // Insurance fields are server-owned (InsuranceVerification). Do not let a
      // stale local draft wipe front-office values seeded into the form.
      const {
        insuranceEligibility: _ie,
        insurancePreAuth: _ip,
        estimatedCoverage: _ec,
        estimatedCopay: _ey,
        ...rest
      } = parsed;
      setDraft((prev) => ({ ...prev, ...rest }));
    } catch {
      // ignore corrupt draft
    }
  }, [hasMounted, encounter.id]);

  useEffect(() => {
    if (!hasMounted || !encounter.id) return;
    try {
      const {
        insuranceEligibility: _ie,
        insurancePreAuth: _ip,
        estimatedCoverage: _ec,
        estimatedCopay: _ey,
        ...persistable
      } = draft;
      localStorage.setItem(draftKey(encounter.id), JSON.stringify(persistable));
    } catch {
      // ignore quota
    }
  }, [draft, hasMounted, encounter.id]);

  function patchDraft(partial: Partial<DraftState>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function refresh() {
    const data = await loadSpineWorkspaceData(appointmentId);
    setEncounter(data.encounter);
    setGates(data.gates);
    setClinicalFindings(data.clinicalFindings);
    router.refresh();
  }

  function run(
    action: () => Promise<unknown>,
    successMsg?: string,
    afterSuccess?: () => void,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        // Spine actions return { ok:false, error } for expected validation failures
        // (gates / billing) so production Next.js does not mask them as RSC digests.
        if (
          result &&
          typeof result === "object" &&
          "ok" in result &&
          (result as { ok: unknown }).ok === false &&
          "error" in result
        ) {
          setError(String((result as { error: unknown }).error));
          return;
        }
        await refresh();
        afterSuccess?.();
        if (successMsg) setMessage(successMsg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const status = encounter.status as EncounterStatus;
  const nextStatuses = LEGAL_FORWARD_TRANSITIONS[status] ?? [];
  const canInterrupt = INTERRUPTIBLE_STATUSES.includes(status);
  const closed = Boolean(encounter.closedAt) || status === "recall_scheduled";
  const write = canWrite && !closed && !pending;
  const assistWrite = canAssist && !closed && !pending;

  const insuranceVerification = encounter.insuranceVerifications[0] ?? null;
  const billingPreview = useMemo(
    () =>
      buildSpineBillingPreview({
        lines: encounter.procedureLines.map((line) => ({
          id: line.id,
          status: line.status,
          billedInvoiceId: line.billedInvoiceId,
          unitPrice: line.unitPrice,
          procedureCatalog: line.procedureCatalog,
          materialUsages: line.materialUsages.map((m) => ({
            quantity: m.quantity,
            unitCost: m.unitCost,
            itemName: m.itemName,
            isBillable: m.isBillable,
            status: m.status,
          })),
        })),
        interruptOutcome: encounter.interruptOutcome,
        estimatedCoverage: insuranceVerification?.estimatedCoverage,
        estimatedCopay: insuranceVerification?.estimatedCopay,
      }),
    [encounter.procedureLines, encounter.interruptOutcome, insuranceVerification],
  );

  // Client-only echo of draft dropdowns. Prices match invoice sources:
  // procedure → ProcedureCatalog.price; material → InventoryItem.cost (= MaterialUsage.unitCost).
  const pendingPriceRows = useMemo((): SpinePendingPriceRow[] => {
    if (closed) return [];
    const rows: SpinePendingPriceRow[] = [];
    const selectedProc = procedures.find((p) => p.id === draft.catalogId);
    if (selectedProc) {
      rows.push({
        id: "pending-procedure",
        kind: "procedure",
        label: `${selectedProc.code} · ${selectedProc.name}`,
        amount: Math.round(selectedProc.price * 100) / 100,
      });
    }
    const selectedItem = inventoryItems.find((i) => i.id === draft.materialItemId);
    const qty = Number(draft.materialQty);
    if (
      selectedItem &&
      draft.materialBillable &&
      Number.isFinite(qty) &&
      qty > 0
    ) {
      rows.push({
        id: "pending-material",
        kind: "material",
        label: `${selectedItem.name} × ${qty}`,
        amount: Math.round(selectedItem.unitCost * qty * 100) / 100,
      });
    }
    return rows;
  }, [
    closed,
    procedures,
    inventoryItems,
    draft.catalogId,
    draft.materialItemId,
    draft.materialQty,
    draft.materialBillable,
  ]);

  // Same chip source as Gate Summary (live gates from buildLiveGateSummary /
  // evaluateInsuranceGate) — do not re-derive with a softer stale→pending map.
  const insuranceChipStatus: GateChipStatus = encounter.preAuthOverridden
    ? "overridden"
    : gates.insurance;

  const insuranceDrawerLabel = useMemo(() => {
    if (!hasMounted || !insuranceVerification?.verifiedAt) return "Insurance";
    const verifiedAt = new Date(insuranceVerification.verifiedAt);
    if (!Number.isFinite(verifiedAt.getTime())) return "Insurance";
    if (
      isVerificationStale({
        verifiedAt,
        staleAfterMinutes: insuranceVerification.staleAfterMinutes,
      })
    ) {
      return "Insurance (stale)";
    }
    return "Insurance";
  }, [hasMounted, insuranceVerification]);

  const findings = clinicalFindings;
  const chartData = (findings?.chartData ?? {}) as ToothChartData;
  const stageProgress = (panel: SpineNavPanelId): "current" | "completed" | "upcoming" => {
    const order: SpineNavPanelId[] = [
      "intake",
      "exam",
      "gates",
      "findings",
      "procedures",
      "close_out",
      "billing",
    ];
    const current = statusToNavStage(status);
    if (panel === "findings") {
      if (order.indexOf(current) >= order.indexOf("procedures")) return "completed";
      if (current === "gates" || activePanel === "findings") return "current";
      return "upcoming";
    }
    const ci = order.indexOf(current);
    const pi = order.indexOf(panel);
    if (pi < ci) return "completed";
    if (pi === ci) return "current";
    return "upcoming";
  };

  function openTool(tool: SpineToolId, opts?: { tooth?: string }) {
    setFocusTooth(opts?.tooth);
    setOverlayTool(tool);
  }

  function selectPanel(panel: SpineNavPanelId) {
    setActivePanel(panel);
    if (typeof document !== "undefined") {
      document.getElementById(`spine-stage-${panel}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  const selectedMaterialLineId =
    draft.materialLineId || encounter.procedureLines[0]?.id || "";
  const selectedMaterialLine =
    encounter.procedureLines.find((l) => l.id === selectedMaterialLineId) ??
    encounter.procedureLines[0];
  const selectedBomLines = selectedMaterialLine
    ? bomByProcedureId[selectedMaterialLine.procedureCatalogId] ?? []
    : [];
  const selectedInventoryItem = inventoryItems.find((i) => i.id === draft.materialItemId);
  const matchingBomLine = selectedBomLines.find(
    (b) => b.inventoryItemId === draft.materialItemId,
  );
  const isAdHocMaterial = Boolean(draft.materialItemId) && !matchingBomLine;
  const lotWarning =
    draft.materialTier === "tracked"
      ? lotExpiryWarning(draft.materialExpiry || null)
      : null;

  useEffect(() => {
    if (!draft.materialItemId || draft.materialTier !== "tracked") {
      setFefoLots([]);
      return;
    }
    let cancelled = false;
    setFefoLoading(true);
    listSpineFefoLots(draft.materialItemId)
      .then((lots) => {
        if (cancelled) return;
        setFefoLots(lots);
        if (!draft.materialLot && lots[0]) {
          patchDraft({
            materialLot: lots[0].lotNumber,
            materialExpiry: lots[0].expiryDate
              ? lots[0].expiryDate.slice(0, 10)
              : "",
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFefoLots([]);
      })
      .finally(() => {
        if (!cancelled) setFefoLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only refetch when item/tier changes — not when lot/expiry edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.materialItemId, draft.materialTier]);

  function applyMaterialItemSelection(itemId: string) {
    const item = inventoryItems.find((i) => i.id === itemId);
    const bom = selectedBomLines.find((b) => b.inventoryItemId === itemId);
    const tier = item?.defaultTier ?? "consumable";
    patchDraft({
      materialItemId: itemId,
      materialTier: tier,
      materialQty: bom ? String(bom.defaultQuantity) : draft.materialQty || "1",
      materialBillable: bom ? bom.isBillable : true,
      materialLot: "",
      materialExpiry: "",
    });
  }

  const bomChecklistSlot =
    encounter.procedureLines.length > 0 ? (
      <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
        <p className={labelCls}>Prep checklist (BoM)</p>
        {selectedBomLines.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            No bill of materials configured for this procedure
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {selectedBomLines.map((b) => (
              <li key={b.id} className="flex justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 text-left hover:text-teal-800"
                  disabled={!write}
                  onClick={() => applyMaterialItemSelection(b.inventoryItemId)}
                >
                  {b.itemName}{" "}
                  <span className="text-slate-400">
                    ({b.isOptional ? "optional" : "required"}
                    {b.isBillable ? " · billable" : " · bundled"})
                  </span>
                </button>
                <span className="shrink-0 font-medium">
                  {b.defaultQuantity} {b.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
        {encounter.procedureLines.length > 1 ? (
          <select
            className={`${field} mt-2`}
            value={selectedMaterialLineId}
            onChange={(e) => patchDraft({ materialLineId: e.target.value })}
            disabled={pending}
          >
            {encounter.procedureLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.procedureCatalog.code}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    ) : null;

  const materialsSlot = (canWrite || canAssist) && !closed && encounter.procedureLines.length > 0 ? (
    <div className="space-y-2">
      {bomChecklistSlot}
      <p className={labelCls}>Add item (BoM or ad-hoc)</p>
      <p className="text-xs text-slate-500">
        Pick a checklist line, or any inventory item not on the BoM.
      </p>
      <div className="grid gap-2">
        <select
          className={field}
          value={selectedMaterialLineId}
          onChange={(e) => patchDraft({ materialLineId: e.target.value })}
          disabled={pending}
        >
          {encounter.procedureLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.procedureCatalog.code}
            </option>
          ))}
        </select>
        <select
          className={field}
          value={draft.materialItemId}
          onChange={(e) => applyMaterialItemSelection(e.target.value)}
          disabled={pending}
        >
          <option value="">Select material…</option>
          {inventoryItems
            .filter((i) => canWrite || i.defaultTier === "consumable")
            .map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {selectedBomLines.some((b) => b.inventoryItemId === i.id)
                ? ""
                : " · ad-hoc"}
            </option>
          ))}
        </select>
        {selectedInventoryItem ? (
          <p className="text-xs text-slate-500">
            Tier: {draft.materialTier}
            {matchingBomLine
              ? matchingBomLine.isBillable
                ? " · BoM billable"
                : " · BoM bundled"
              : " · ad-hoc"}
          </p>
        ) : null}
        <input
          className={field}
          type="number"
          min={0.01}
          step="0.01"
          value={draft.materialQty}
          onChange={(e) => patchDraft({ materialQty: e.target.value })}
          disabled={pending}
          placeholder="Qty"
        />
        {isAdHocMaterial ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.materialBillable}
              onChange={(e) => patchDraft({ materialBillable: e.target.checked })}
              disabled={pending}
            />
            Billable (separate invoice line)
          </label>
        ) : null}
        {draft.materialTier === "tracked" ? (
          <>
            {fefoLoading ? (
              <p className="text-xs text-slate-500">Loading lots (FEFO)…</p>
            ) : fefoLots.length > 0 ? (
              <select
                className={field}
                value={draft.materialLot}
                onChange={(e) => {
                  const lot = fefoLots.find((l) => l.lotNumber === e.target.value);
                  patchDraft({
                    materialLot: e.target.value,
                    materialExpiry: lot?.expiryDate
                      ? lot.expiryDate.slice(0, 10)
                      : draft.materialExpiry,
                  });
                }}
                disabled={pending}
              >
                <option value="">Select lot (FEFO)…</option>
                {fefoLots.map((l) => (
                  <option key={l.batchId} value={l.lotNumber}>
                    {l.lotNumber}
                    {l.expiryDate
                      ? ` · exp ${l.expiryDate.slice(0, 10)}`
                      : " · no expiry"}
                    {` · qty ${l.currentQty}`}
                    {l.isExpired ? " · EXPIRED" : l.isNearExpiry ? " · near expiry" : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              className={field}
              value={draft.materialLot}
              onChange={(e) => patchDraft({ materialLot: e.target.value })}
              disabled={pending}
              placeholder="Lot number"
            />
            <input
              className={field}
              type="date"
              value={draft.materialExpiry}
              onChange={(e) => patchDraft({ materialExpiry: e.target.value })}
              disabled={pending}
            />
            {lotWarning ? (
              <p
                className={
                  lotWarning.level === "expired"
                    ? "rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-800"
                    : "rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900"
                }
                role="alert"
              >
                {lotWarning.message}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <button
        type="button"
        className={btnSecondary}
        disabled={
          !(canWrite ? write : assistWrite) ||
          !draft.materialItemId ||
          (!canWrite && draft.materialTier !== "consumable")
        }
        onClick={() =>
          run(
            () =>
              logSpineMaterial({
                procedureLineId:
                  draft.materialLineId || encounter.procedureLines[0]!.id,
                itemId: draft.materialItemId,
                // Nurses (assist-only) may log consumable-tier materials only.
                tier: canWrite ? draft.materialTier : "consumable",
                quantity: Number(draft.materialQty) || 1,
                isBillable: matchingBomLine
                  ? matchingBomLine.isBillable
                  : draft.materialBillable,
                lotNumber:
                  draft.materialTier === "tracked" ? draft.materialLot || null : null,
                expiryDate:
                  draft.materialTier === "tracked" && draft.materialExpiry
                    ? draft.materialExpiry
                    : null,
              }),
            "Material logged",
            () =>
              patchDraft({
                materialItemId: "",
                materialQty: "1",
                materialLot: "",
                materialExpiry: "",
                materialBillable: true,
                materialTier: "consumable",
              }),
          )
        }
      >
        Add item
      </button>
    </div>
  ) : bomChecklistSlot;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full bg-slate-50/40">
      <SpineStageNav
        currentStatus={status}
        activePanel={activePanel}
        onSelectPanel={selectPanel}
        collapsed={navCollapsed}
        onToggleCollapsed={() => setNavCollapsed((v) => !v)}
        onOpenTool={(tool) => openTool(tool)}
      />

      <div
        className={`flex min-w-0 flex-1 flex-col gap-4 px-3 py-4 sm:px-4 ${
          drawerOpen ? "xl:pr-[24rem]" : "xl:pr-16"
        }`}
      >
      <header className="space-y-2 border-b border-slate-200 pb-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
          Encounter spine
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl text-slate-900 sm:text-3xl">
              {initial.patient.firstName} {initial.patient.lastName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {initial.patient.patientNumber
                ? `#${initial.patient.patientNumber} · `
                : ""}
              Status{" "}
              <span className="font-medium text-slate-800">{statusLabel(status)}</span>
              {encounter.startedAt ? (
                <>
                  {" "}
                  · started {formatTime(encounter.startedAt, hasMounted)}
                </>
              ) : null}
            </p>
          </div>
          <Link
            href={`/clinical/encounter/${appointmentId}/timeline`}
            className="min-h-10 text-sm text-teal-800 underline-offset-4 hover:underline"
          >
            Timeline
          </Link>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await createVisitShareLink(encounter.id);
                  setVisitShareUrl(result.shareUrl);
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    await navigator.clipboard.writeText(result.shareUrl).catch(() => null);
                  }
                  return result;
                }, "Patient visit link ready")
              }
            >
              Patient visit view
            </button>
            {visitShareUrl ? (
              <a
                href={visitShareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-teal-800 underline-offset-4 hover:underline"
              >
                Open visit link
              </a>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
            {message}
          </p>
        ) : null}
        {encounter.billedInvoice ? (
          <p className="text-sm text-slate-600">
            Invoiced as {encounter.billedInvoice.invoiceNumber} (
            {encounter.billedInvoice.status}) · total {encounter.billedInvoice.total}
          </p>
        ) : null}
        {billingPreview.gateMessage && !encounter.billedInvoice ? (
          <p className="text-xs text-amber-800">{billingPreview.gateMessage}</p>
        ) : null}
      </header>

      {/* Status transitions stay outside collapsible cards so advances are always reachable. */}
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Status
        </h2>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((to) => (
            <button
              key={to}
              type="button"
              className={btnPrimary}
              disabled={!write}
              onClick={() =>
                run(async () => {
                  if (status === "gates" && to === "procedure_execution") {
                    await advanceSpinePastGates(encounter.id);
                  } else {
                    await transitionSpineEncounter({
                      encounterId: encounter.id,
                      toStatus: to,
                    });
                  }
                }, `Moved to ${statusLabel(to)}`)
              }
            >
              → {statusLabel(to)}
            </button>
          ))}
          {nextStatuses.length === 0 && status !== "interrupted" ? (
            <p className="text-sm text-slate-500">No forward transitions available.</p>
          ) : null}
        </div>
      </section>

      <div id="spine-stage-intake">
      <SpineStageCard
        id="intake"
        title="Intake summary"
        summary={
          initial.patient.allergies?.length
            ? `Allergies: ${initial.patient.allergies.join(", ")}`
            : "No allergies recorded"
        }
        state={stageProgress("intake")}
      >
      <section className="space-y-2">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={labelCls}>Allergies</dt>
            <dd className="mt-1 text-sm text-slate-800">
              {initial.patient.allergies?.length
                ? initial.patient.allergies.join(", ")
                : "None recorded"}
            </dd>
          </div>
          <div>
            <dt className={labelCls}>Medical history</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {initial.patient.medicalHistory?.trim() || "None recorded"}
            </dd>
          </div>
        </dl>
      </section>
      </SpineStageCard>
      </div>

      <div id="spine-stage-exam">
        <SpineStageCard
          id="exam"
          title="Chief Complaint / Exam"
          summary={
            encounter.examCompletedAt
              ? `Completed ${formatTime(encounter.examCompletedAt, hasMounted)}`
              : "Document exam before gates"
          }
          state={stageProgress("exam")}
        >
          {encounter.examCompletedAt ? (
            <p className="text-sm text-slate-600">Exam recorded by clinical staff.</p>
          ) : canWrite ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <textarea className={field} rows={3} placeholder="Chief complaint" value={draft.chiefComplaint} onChange={(e) => patchDraft({ chiefComplaint: e.target.value })} disabled={pending} />
              <textarea className={field} rows={3} placeholder="Findings" value={draft.findings} onChange={(e) => patchDraft({ findings: e.target.value })} disabled={pending} />
              <div className="space-y-2">
                <textarea className={field} rows={3} placeholder="Provisional diagnosis" value={draft.provisionalDiagnosis} onChange={(e) => patchDraft({ provisionalDiagnosis: e.target.value })} disabled={pending} />
                <button type="button" className={btnPrimary} disabled={!write} onClick={() => run(() => completeSpineExam({ encounterId: encounter.id, chiefComplaint: draft.chiefComplaint, findings: draft.findings, provisionalDiagnosis: draft.provisionalDiagnosis }), "Exam completed")}>Mark exam complete</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">A clinician must complete the exam.</p>
          )}
        </SpineStageCard>
      </div>

      {/* Gates */}
      <div id="spine-stage-gates">
      <SpineStageCard
        id="gates"
        title="Gate summary"
        summary={`R ${gates.risk} · C ${gates.consent} · I ${gates.insurance} · S ${gates.sterilization}`}
        state={stageProgress("gates")}
      >
      <div className="space-y-4">
        <EncounterGateSummary
          gates={gates}
          insuranceOverridden={encounter.preAuthOverridden}
          footer={
            encounter.preAuthOverridden ? (
              <p className="text-xs text-amber-800">
                Pre-auth overridden
                {encounter.preAuthOverrideReason
                  ? `: ${encounter.preAuthOverrideReason}`
                  : ""}
              </p>
            ) : null
          }
        />

        {(canWrite || canWriteInsurance) && !closed ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {canWrite ? (
              <>
                <div className="space-y-2">
                  <label className={labelCls} htmlFor="asa">
                    ASA class
                  </label>
                  <input
                    id="asa"
                    className={field}
                    value={draft.asaClass}
                    onChange={(e) => patchDraft({ asaClass: e.target.value })}
                    placeholder="e.g. II"
                    disabled={pending}
                  />
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!write}
                    onClick={() =>
                      run(
                        () =>
                          clearSpineRisk({
                            encounterId: encounter.id,
                            asaClass: draft.asaClass || undefined,
                          }),
                        "Risk cleared",
                      )
                    }
                  >
                    Clear risk
                  </button>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>Consent</p>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!write}
                    onClick={() =>
                      run(
                        () => grantSpineConsent({ encounterId: encounter.id }),
                        "Consent granted",
                      )
                    }
                  >
                    Grant clinical consent
                  </button>
                </div>
              </>
            ) : null}

            {canWriteInsurance ? (
              <div className="space-y-2 sm:col-span-2">
                <p className={labelCls}>Insurance verification</p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div>
                    <label className={labelCls} htmlFor="elig">
                      Eligibility
                    </label>
                    <select
                      id="elig"
                      className={field}
                      value={draft.insuranceEligibility}
                      onChange={(e) => patchDraft({ insuranceEligibility: e.target.value })}
                      disabled={pending}
                    >
                      {["pending", "eligible", "ineligible", "unknown", "error"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="preauth">
                      Pre-auth
                    </label>
                    <select
                      id="preauth"
                      className={field}
                      value={draft.insurancePreAuth}
                      onChange={(e) => patchDraft({ insurancePreAuth: e.target.value })}
                      disabled={pending}
                    >
                      {["not_required", "pending", "approved", "denied", "expired"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="cov">
                      Est. coverage
                    </label>
                    <input
                      id="cov"
                      className={field}
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.estimatedCoverage}
                      onChange={(e) => patchDraft({ estimatedCoverage: e.target.value })}
                      disabled={pending}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="copay">
                      Est. copay
                    </label>
                    <input
                      id="copay"
                      className={field}
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.estimatedCopay}
                      onChange={(e) => patchDraft({ estimatedCopay: e.target.value })}
                      disabled={pending}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={pending || closed || !canWriteInsurance}
                  onClick={() =>
                    run(
                      () =>
                        upsertSpineInsuranceVerification({
                          encounterId: encounter.id,
                          eligibilityStatus: draft.insuranceEligibility,
                          preAuthStatus: draft.insurancePreAuth,
                          estimatedCoverage: draft.estimatedCoverage
                            ? Number(draft.estimatedCoverage)
                            : undefined,
                          estimatedCopay: draft.estimatedCopay
                            ? Number(draft.estimatedCopay)
                            : undefined,
                        }),
                      "Insurance saved",
                    )
                  }
                >
                  Save insurance verification
                </button>
              </div>
            ) : null}

            {canWrite ? (
              <div className="space-y-2 sm:col-span-2">
                <p className={labelCls}>Pre-auth override</p>
                <input
                  className={field}
                  value={draft.overrideReason}
                  onChange={(e) => patchDraft({ overrideReason: e.target.value })}
                  placeholder="Reason for override"
                  disabled={pending}
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.patientAck}
                    onChange={(e) => patchDraft({ patientAck: e.target.checked })}
                    disabled={pending}
                  />
                  Patient acknowledged financial responsibility
                </label>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!write || !draft.overrideReason.trim() || !draft.patientAck}
                  onClick={() =>
                    run(
                      () =>
                        overrideSpinePreAuth({
                          encounterId: encounter.id,
                          reason: draft.overrideReason,
                          patientAcknowledged: draft.patientAck,
                        }),
                      "Pre-auth overridden",
                    )
                  }
                >
                  Override pre-auth
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      </SpineStageCard>
      </div>

      <div id="spine-stage-findings">
        <SpineStageCard
          id="findings"
          title="Clinical findings"
          summary={
            findings?.perioSummary
              ? `Perio on file · ${findings.radiographs.length} rad · ${findings.photos.length} photos`
              : `${findings?.radiographs.length ?? 0} rad · ${findings?.photos.length ?? 0} photos`
          }
          state={stageProgress("findings")}
        >
          <SpineClinicalFindings
            chartData={chartData}
            perioSummary={findings?.perioSummary ?? null}
            radiographs={findings?.radiographs ?? []}
            photos={findings?.photos ?? []}
            onOpenTool={openTool}
          />
        </SpineStageCard>
      </div>

      {/* Procedures */}
      <div id="spine-stage-procedures">
      <SpineStageCard
        id="procedures"
        title="Procedure lines"
        summary={
          encounter.procedureLines.length
            ? `${encounter.procedureLines.length} line(s) · ${encounter.procedureLines.filter((l) => l.status === "completed").length} completed`
            : "No procedure lines yet"
        }
        state={stageProgress("procedures")}
      >
      <section className="space-y-3">
        <h2 className="sr-only">Procedure lines</h2>

        {canWrite && !closed ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1">
                <label className={labelCls} htmlFor="proc">
                  Add procedure
                </label>
                <select
                  id="proc"
                  className={field}
                  value={draft.catalogId}
                  onChange={(e) => {
                    patchDraft({ catalogId: e.target.value });
                    setPreCheckOk(true);
                  }}
                  disabled={pending}
                >
                  <option value="">Select procedure…</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={btnPrimary}
                disabled={!write || !draft.catalogId || !preCheckOk}
                onClick={() =>
                  run(
                    () =>
                      addSpineProcedureLine({
                        encounterId: encounter.id,
                        procedureCatalogId: draft.catalogId,
                      }),
                    "Procedure line added",
                    () => patchDraft({ catalogId: "" }),
                  )
                }
              >
                Add line
              </button>
            </div>
            {draft.catalogId ? (
              <PreClinicalChecks
                procedureId={draft.catalogId}
                patientId={initial.patient.id}
                procedureName={
                  procedures.find((p) => p.id === draft.catalogId)?.name
                }
                onChecksComplete={setPreCheckOk}
              />
            ) : null}
          </div>
        ) : null}

        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {encounter.procedureLines.map((line) => (
            <li key={line.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {line.procedureCatalog.code} · {line.procedureCatalog.name}
                  </p>
                  {line.toothNumbers?.length ? (
                    <p className="mt-0.5 flex flex-wrap gap-1 text-xs text-slate-600">
                      {line.toothNumbers.map((tooth) => (
                        <button
                          key={`${line.id}-${tooth}`}
                          type="button"
                          className="min-h-10 min-w-10 rounded-md px-2 font-medium text-teal-800 hover:bg-teal-50"
                          onClick={() => openTool("odontogram", { tooth })}
                        >
                          Tooth {tooth}
                        </button>
                      ))}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    {statusLabel(line.status)}
                    {line.sterilizationLoggedAt
                      ? ` · sterilized ${formatTime(line.sterilizationLoggedAt, hasMounted)}`
                      : " · sterilization pending"}
                    {line.unitPrice != null ? ` · ${line.unitPrice}` : ""}
                    {line.cosignAt ? " · co-signed" : ""}
                  </p>
                </div>
                {canWrite && !closed ? (
                  <div className="flex flex-wrap gap-1.5">
                    {line.status === "planned" ? (
                      <>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={!write}
                          onClick={() =>
                            run(
                              () =>
                                transitionSpineProcedureLine({
                                  lineId: line.id,
                                  toStatus: "in_progress" as EncounterProcedureLineStatus,
                                }),
                              "Started",
                            )
                          }
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={!write}
                          onClick={() =>
                            run(() =>
                              transitionSpineProcedureLine({
                                lineId: line.id,
                                toStatus: "declined",
                              }),
                            )
                          }
                        >
                          Decline
                        </button>
                      </>
                    ) : null}
                    {line.status === "in_progress" ? (
                      <>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={!write}
                          onClick={() => {
                            const label = `${line.procedureCatalog.code} · ${line.procedureCatalog.name}`;
                            if (
                              isAnaesthesiaOrSedationCategory(
                                line.procedureCatalog.category,
                              )
                            ) {
                              setCosignLine({ id: line.id, label });
                              return;
                            }
                            run(() =>
                              transitionSpineProcedureLine({
                                lineId: line.id,
                                toStatus: "completed",
                              }),
                            );
                          }}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={!write}
                          onClick={() =>
                            run(() =>
                              transitionSpineProcedureLine({
                                lineId: line.id,
                                toStatus: "declined",
                              }),
                            )
                          }
                        >
                          Decline
                        </button>
                      </>
                    ) : null}
                    {!line.sterilizationLoggedAt &&
                    (line.status === "planned" || line.status === "in_progress") ? (
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={!write}
                        onClick={() =>
                          run(
                            () => logSpineSterilization({ lineId: line.id }),
                            "Sterilization logged",
                          )
                        }
                      >
                        Sterilize
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {line.materialUsages.length > 0 ? (
                <ul className="space-y-1.5 pl-3 text-xs text-slate-600">
                  {line.materialUsages.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        {m.itemName ?? "Material"} · qty {m.quantity}
                        {m.lotNumber ? ` · lot ${m.lotNumber}` : ""}
                        {m.isBillable ? " · billable" : " · bundled"}
                        {m.status === "returned" ? (
                          <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-700">
                            returned
                          </span>
                        ) : null}
                      </span>
                      {m.status !== "returned" && write && !encounter.billedInvoice ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-teal-800 underline-offset-2 hover:underline"
                          onClick={() =>
                            run(
                              () => returnSpineMaterial(m.id),
                              "Returned to store",
                            )
                          }
                        >
                          Mark as not used — return to store
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
          {encounter.procedureLines.length === 0 ? (
            <li className="py-3 text-sm text-slate-500">No procedure lines yet.</li>
          ) : null}
        </ul>

        {materialsSlot ? (
          <div className="space-y-2 border-t border-slate-100 pt-3">{materialsSlot}</div>
        ) : null}
      </section>

      {/* Pain */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Pain score
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelCls} htmlFor="pain">
              Score (0–10)
            </label>
            <input
              id="pain"
              className={field}
              type="number"
              min={0}
              max={10}
              value={draft.painScore}
              onChange={(e) => patchDraft({ painScore: e.target.value })}
              disabled={!canWrite || pending || closed}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="painNext">
              Next action (≥{initial.painScoreThreshold})
            </label>
            <select
              id="painNext"
              className={field}
              value={draft.painNextAction}
              onChange={(e) => patchDraft({ painNextAction: e.target.value })}
              disabled={!canWrite || pending || closed}
            >
              <option value="">—</option>
              <option value="extra_anesthetic">extra anesthetic</option>
              <option value="paused">paused</option>
              <option value="follow_up_flagged">follow-up flagged</option>
            </select>
          </div>
          <button
            type="button"
            className={btnPrimary}
            disabled={!write || draft.painScore === ""}
            onClick={() =>
              run(
                () =>
                  recordSpinePainScore({
                    encounterId: encounter.id,
                    painScore: Number(draft.painScore),
                    nextAction:
                      draft.painNextAction === "extra_anesthetic" ||
                      draft.painNextAction === "paused" ||
                      draft.painNextAction === "follow_up_flagged"
                        ? draft.painNextAction
                        : null,
                  }),
                "Pain score saved",
              )
            }
          >
            Record pain
          </button>
        </div>
      </section>

      {/* Interrupt */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Interrupt
        </h2>
        {status === "interrupted" ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              Incident: {encounter.incidentNote || "—"}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["resumed", "Resume"],
                  ["abandoned_partial_bill", "Abandon · partial bill"],
                  ["abandoned_no_bill", "Abandon · no bill"],
                ] as const
              ).map(([outcome, label]) => (
                <button
                  key={outcome}
                  type="button"
                  className={outcome === "resumed" ? btnPrimary : btnSecondary}
                  disabled={!write}
                  onClick={() =>
                    run(
                      () =>
                        resolveSpineInterrupt({
                          encounterId: encounter.id,
                          outcome: outcome as InterruptOutcome,
                        }),
                      label,
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : canInterrupt && canWrite && !closed ? (
          <div className="space-y-2">
            <label className={labelCls} htmlFor="incident">
              Incident note
            </label>
            <textarea
              id="incident"
              className={field}
              rows={2}
              value={draft.incidentNote}
              onChange={(e) => patchDraft({ incidentNote: e.target.value })}
              disabled={pending}
            />
            <button
              type="button"
              className={btnDanger}
              disabled={!write || !draft.incidentNote.trim()}
              onClick={() =>
                run(
                  () =>
                    interruptSpineEncounter({
                      encounterId: encounter.id,
                      incidentNote: draft.incidentNote,
                    }),
                  "Encounter interrupted",
                )
              }
            >
              Interrupt encounter
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Interrupt available during procedure execution, close-out, or billing.
          </p>
        )}
      </section>
      </SpineStageCard>
      </div>

      {/* Close-out: Rx allergy check, recall, notes/images reuse */}
      <div id="spine-stage-close_out">
      <SpineStageCard
        id="close_out"
        title="Close-out"
        summary={
          encounter.closedAt
            ? `Closed · ${encounter.closedReason ?? "done"}`
            : "Rx, notes, recall"
        }
        state={stageProgress("close_out")}
      >
      <section className="space-y-3">
        <h2 className="sr-only">Close-out</h2>
        <p className="text-sm text-slate-600">
          Current meds:{" "}
          {initial.patient.medications?.length
            ? initial.patient.medications.join(", ")
            : "None recorded"}
        </p>
        {canWrite && !closed ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelCls} htmlFor="rx">
                Prescription / discharge meds
              </label>
              <textarea
                id="rx"
                className={field}
                rows={3}
                value={draft.prescriptionText}
                onChange={(e) => patchDraft({ prescriptionText: e.target.value })}
                placeholder="e.g. Amoxicillin 500mg…"
                disabled={pending}
              />
              {(() => {
                const hits = findPrescriptionAllergyConflicts(
                  initial.patient.allergies,
                  draft.prescriptionText,
                );
                if (!hits.length) return null;
                return (
                  <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
                    <p>
                      Allergy cross-check warning: may conflict with{" "}
                      {hits.map((h) => h.allergy).join(", ")}.
                    </p>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draft.ackAllergyConflict}
                        onChange={(e) =>
                          patchDraft({ ackAllergyConflict: e.target.checked })
                        }
                      />
                      Patient/clinician acknowledged — proceed anyway
                    </label>
                  </div>
                );
              })()}
              <label className={labelCls} htmlFor="closeNote">
                Clinical close-out note
              </label>
              <textarea
                id="closeNote"
                className={field}
                rows={2}
                value={draft.closeOutNote}
                onChange={(e) => patchDraft({ closeOutNote: e.target.value })}
                disabled={pending}
              />
              <button
                type="button"
                className={btnSecondary}
                disabled={
                  !write ||
                  (!draft.prescriptionText.trim() && !draft.closeOutNote.trim())
                }
                onClick={() =>
                  run(
                    () =>
                      saveSpineCloseOutNote({
                        encounterId: encounter.id,
                        prescriptionText: draft.prescriptionText,
                        clinicalNote: draft.closeOutNote,
                        acknowledgeAllergyConflict: draft.ackAllergyConflict,
                      }),
                    "Close-out note saved",
                  )
                }
              >
                Save close-out note
              </button>
              <p className="text-xs text-slate-500">
                Full SOAP editor stays optional; prefer notes in close-out above.
                If you open the classic chart, use Back to encounter to return.
              </p>
              <Link
                href={`/clinical?patientId=${encodeURIComponent(initial.patient.id)}&fromSpine=1&returnAppointmentId=${encodeURIComponent(appointmentId)}`}
                className="text-sm text-teal-800 underline-offset-4 hover:underline"
              >
                Open clinical notes (classic chart)
              </Link>
            </div>
            <div className="space-y-2">
              <label className={labelCls} htmlFor="recallMonths">
                Schedule recall (months)
              </label>
              <input
                id="recallMonths"
                type="number"
                min={1}
                max={24}
                className={field}
                value={draft.recallMonths}
                onChange={(e) => patchDraft({ recallMonths: e.target.value })}
                disabled={pending}
              />
              <button
                type="button"
                className={btnPrimary}
                disabled={!write}
                onClick={() =>
                  run(
                    () =>
                      scheduleSpineRecall({
                        encounterId: encounter.id,
                        intervalMonths: Number(draft.recallMonths) || 6,
                      }),
                    "Recall scheduled",
                  )
                }
              >
                Schedule recall
              </button>
              <p className="text-xs text-slate-500">
                Or book on calendar:{" "}
                <Link
                  href={`/appointments?patientId=${initial.patient.id}`}
                  className="text-teal-800 underline-offset-4 hover:underline"
                >
                  Appointments
                </Link>
              </p>
            </div>
          </div>
        ) : null}

        {initial.clinicalImages?.length ? (
          <div className="space-y-2">
            <p className={labelCls}>Recent clinical images</p>
            <ImageGallery
              canDelete={false}
              images={initial.clinicalImages.map((img) => ({
                id: img.id,
                url: img.url,
                type: img.type,
                fileName: img.fileName,
                toothNumbers: null,
                quadrant: null,
                notes: null,
                takenAt: img.takenAt,
                annotations: [],
              }))}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No clinical images yet. Use Radiographs / Photos in the encounter
            tools rail to capture or upload without leaving this visit.
          </p>
        )}
      </section>
      </SpineStageCard>
      </div>

      {/* Close */}
      <div id="spine-stage-billing">
      <SpineStageCard
        id="billing"
        title="Billing"
        summary={
          encounter.billedInvoice
            ? `${encounter.billedInvoice.invoiceNumber} · ${encounter.billedInvoice.total}`
            : `Projected ${billingPreview.projectedTotal.toFixed(2)}`
        }
        state={stageProgress("billing")}
      >
      <section className="space-y-3 border-t border-slate-200 pt-4">
        <h2 className="sr-only">Billing</h2>
        <button
          type="button"
          className={btnPrimary}
          disabled={!canWrite || closed || pending || Boolean(encounter.billedInvoice)}
          onClick={() =>
            run(
              () => closeAndInvoiceSpineEncounter(encounter.id),
              "Encounter closed and invoiced",
            )
          }
        >
          Close & invoice
        </button>
        {closed ? (
          <p className="text-sm text-slate-500">
            Closed{encounter.closedReason ? ` · ${encounter.closedReason}` : ""}
            {encounter.closedAt
              ? ` · ${formatTime(encounter.closedAt, hasMounted)}`
              : ""}
          </p>
        ) : null}
      </section>
      </SpineStageCard>
      </div>
      </div>

      <SpineBillingDrawer
        preview={billingPreview}
        pendingRows={pendingPriceRows}
        billedInvoice={
          encounter.billedInvoice
            ? {
                invoiceNumber: encounter.billedInvoice.invoiceNumber,
                total: encounter.billedInvoice.total,
                status: encounter.billedInvoice.status,
              }
            : null
        }
        insuranceChipStatus={insuranceChipStatus}
        insuranceLabel={insuranceDrawerLabel}
        nurseMode={canAssist && !canWrite}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      >
        <div className="hidden xl:block">{materialsSlot}</div>
      </SpineBillingDrawer>

      {canAssist && !canWrite ? (
        <div className="fixed bottom-4 left-4 z-30 flex max-w-md flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Nurse presence
          </p>
          <div className="flex flex-wrap gap-2">
            {NURSE_PRESENCE_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={btnSecondary}
                disabled={!assistWrite}
                onClick={() =>
                  run(
                    () =>
                      recordSpineNursePresence({
                        encounterId: encounter.id,
                        stage,
                      }),
                    `Presence: ${stage.replaceAll("_", " ")}`,
                  )
                }
              >
                {stage.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <Link
            href="/clinical/chair-prep"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white"
          >
            Chair prep
          </Link>
        </div>
      ) : null}

      <SpineToolOverlay
        open={overlayTool != null}
        onOpenChange={(open) => {
          if (!open) {
            setOverlayTool(null);
            setFocusTooth(undefined);
          }
        }}
        tool={overlayTool}
        chartData={chartData}
        focusTooth={focusTooth}
        radiographs={findings?.radiographs ?? []}
        photos={findings?.photos ?? []}
        patientName={`${initial.patient.firstName} ${initial.patient.lastName}`}
        patientId={initial.patient.id}
        appointmentId={appointmentId}
        treatmentPlan={findings?.treatmentPlan ?? null}
        perioMeasurements={(findings?.perioMeasurements ?? []) as PerioMeasurement[]}
        canMarkPatientShareable={canWrite}
        onTogglePatientShareable={
          canWrite
            ? (imageId, patientShareable) =>
                run(
                  () => setImagePatientShareable({ imageId, patientShareable }),
                  patientShareable
                    ? "Photo marked shareable for visit view"
                    : "Photo hidden from visit view",
                )
            : undefined
        }
      />
      <AnaesthesiaCosignDialog
        open={cosignLine != null}
        procedureLabel={cosignLine?.label ?? "this anaesthesia procedure"}
        pending={pending}
        error={error}
        onCancel={() => setCosignLine(null)}
        onConfirm={(email, password) => {
          if (!cosignLine) return;
          run(
            () =>
              transitionSpineProcedureLine({
                lineId: cosignLine.id,
                toStatus: "completed",
                cosignEmail: email,
                cosignPassword: password,
              }),
            "Procedure completed with co-sign",
            () => setCosignLine(null),
          );
        }}
      />
    </div>
  );
}
