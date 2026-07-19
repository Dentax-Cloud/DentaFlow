"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EncounterGateSummary } from "@/components/clinical/encounter-gate-summary";
import {
  LEGAL_FORWARD_TRANSITIONS,
  INTERRUPTIBLE_STATUSES,
  type InterruptOutcome,
} from "@/lib/encounter/state-machine";
import type { EncounterStatus, EncounterProcedureLineStatus } from "@/lib/encounter/types";
import type { GateSummary } from "@/lib/encounter/types";
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
  recordSpinePainScore,
  advanceSpinePastGates,
  closeAndInvoiceSpineEncounter,
  loadSpineWorkspaceData,
  scheduleSpineRecall,
  saveSpineCloseOutNote,
} from "@/app/(dashboard)/features/clinical/encounter-spine-actions";
import { findPrescriptionAllergyConflicts } from "@/lib/encounter/close-out";
import { PreClinicalChecks } from "@/components/clinical/pre-clinical-checks";
import { ImageGallery } from "@/components/clinical/image-gallery";

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
  prescriptionText: string;
  closeOutNote: string;
  ackAllergyConflict: boolean;
  recallMonths: string;
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
  prescriptionText: "",
  closeOutNote: "",
  ackAllergyConflict: false,
  recallMonths: "6",
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
  initial,
}: {
  appointmentId: string;
  canWrite: boolean;
  initial: SpineWorkspaceData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hasMounted, setHasMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [encounter, setEncounter] = useState<SpineEncounterSerialized>(initial.encounter);
  const [gates, setGates] = useState<GateSummary>(initial.gates);
  const [procedures] = useState<SpineCatalogSnippet[]>(initial.procedures);
  const [inventoryItems] = useState<SpineInventorySnippet[]>(initial.inventoryItems);
  const [preCheckOk, setPreCheckOk] = useState(true);
  const [draft, setDraft] = useState<DraftState>(() => ({
    ...EMPTY_DRAFT,
    asaClass: initial.encounter.riskAssessments[0]?.asaClass ?? "",
    painScore:
      initial.encounter.painScore != null ? String(initial.encounter.painScore) : "",
    painNextAction: initial.encounter.painNextAction ?? "",
    catalogId: initial.procedures[0]?.id ?? "",
    materialItemId: initial.inventoryItems[0]?.id ?? "",
  }));

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || !encounter.id) return;
    try {
      const raw = localStorage.getItem(draftKey(encounter.id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DraftState>;
      setDraft((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore corrupt draft
    }
  }, [hasMounted, encounter.id]);

  useEffect(() => {
    if (!hasMounted || !encounter.id) return;
    try {
      localStorage.setItem(draftKey(encounter.id), JSON.stringify(draft));
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
    router.refresh();
  }

  function run(action: () => Promise<unknown>, successMsg?: string) {
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
      <header className="space-y-2 border-b border-slate-200 pb-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
          Encounter spine
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-slate-900">
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
            className="text-sm text-teal-800 underline-offset-4 hover:underline"
          >
            Timeline
          </Link>
        </div>
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
      </header>

      {/* Intake */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Intake summary
        </h2>
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

      {/* Gates */}
      <div className="space-y-4">
        <EncounterGateSummary
          gates={gates}
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

        {canWrite && !closed ? (
          <div className="grid gap-4 sm:grid-cols-2">
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
                  run(() => grantSpineConsent({ encounterId: encounter.id }), "Consent granted")
                }
              >
                Grant clinical consent
              </button>
            </div>

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
                disabled={!write}
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
          </div>
        ) : null}
      </div>

      {/* Status transitions */}
      <section className="space-y-3">
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

      {/* Procedures */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Procedure lines
        </h2>

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
                  <p className="text-xs text-slate-500">
                    {statusLabel(line.status)}
                    {line.sterilizationLoggedAt
                      ? ` · sterilized ${formatTime(line.sterilizationLoggedAt, hasMounted)}`
                      : " · sterilization pending"}
                    {line.unitPrice != null ? ` · ${line.unitPrice}` : ""}
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
                          onClick={() =>
                            run(() =>
                              transitionSpineProcedureLine({
                                lineId: line.id,
                                toStatus: "completed",
                              }),
                            )
                          }
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
                <ul className="pl-3 text-xs text-slate-600">
                  {line.materialUsages.map((m) => (
                    <li key={m.id}>
                      Material · qty {m.quantity}
                      {m.lotNumber ? ` · lot ${m.lotNumber}` : ""}
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

        {canWrite && !closed && encounter.procedureLines.length > 0 ? (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className={labelCls}>Log material</p>
            <div className="grid gap-2 sm:grid-cols-5">
              <select
                className={field}
                value={draft.materialLineId || encounter.procedureLines[0]?.id || ""}
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
                onChange={(e) => patchDraft({ materialItemId: e.target.value })}
                disabled={pending}
              >
                {inventoryItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <select
                className={field}
                value={draft.materialTier}
                onChange={(e) =>
                  patchDraft({ materialTier: e.target.value as "tracked" | "consumable" })
                }
                disabled={pending}
              >
                <option value="consumable">consumable</option>
                <option value="tracked">tracked</option>
              </select>
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
              <input
                className={field}
                value={draft.materialLot}
                onChange={(e) => patchDraft({ materialLot: e.target.value })}
                disabled={pending}
                placeholder="Lot (tracked)"
              />
            </div>
            <button
              type="button"
              className={btnSecondary}
              disabled={!write || !draft.materialItemId}
              onClick={() =>
                run(
                  () =>
                    logSpineMaterial({
                      procedureLineId:
                        draft.materialLineId || encounter.procedureLines[0]!.id,
                      itemId: draft.materialItemId,
                      tier: draft.materialTier,
                      quantity: Number(draft.materialQty) || 1,
                      lotNumber: draft.materialLot || null,
                    }),
                  "Material logged",
                )
              }
            >
              Log material
            </button>
          </div>
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

      {/* Close-out: Rx allergy check, recall, notes/images reuse */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Close-out
        </h2>
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
                Full SOAP editor:{" "}
                <Link
                  href={`/clinical?patientId=${initial.patient.id}`}
                  className="text-teal-800 underline-offset-4 hover:underline"
                >
                  Open clinical notes
                </Link>
              </p>
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
            No clinical images yet. Capture from radiographs/photos tabs on the
            classic workspace when the spine flag is off, or via UploadThing flows.
          </p>
        )}
      </section>

      {/* Close */}
      <section className="space-y-3 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          Close & invoice
        </h2>
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
    </div>
  );
}
