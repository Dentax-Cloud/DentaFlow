"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Odontogram } from "@/components/clinical/dental-chart";
import { ToothDetailPanel, type AddConditionInput } from "@/components/clinical/tooth-detail-panel";
import { ClinicalNoteEditor, type ClinicalTemplateOption } from "@/components/clinical/clinical-note-editor";
import { TreatmentSuggestionsPanel } from "@/components/clinical/treatment-suggestions-panel";
import { ChartHistoryTimeline } from "@/components/clinical/chart-history-timeline";
import { ChartExportButton } from "@/components/clinical/chart-export";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import { chartToSummary } from "@/lib/clinical/chart-types";
import type { ChartNotation } from "@/lib/clinical/odontogram-notation";
import type { ToothSurface } from "@/lib/clinical/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createToothCondition,
  deleteToothCondition,
  generateSoapNote,
  loadPatientChart,
  aiSuggestTreatment,
  saveSuggestedTreatmentPlan,
  markToothMissing,
  restoreToothStatus,
} from "@/app/(dashboard)/features/clinical/actions";
import { ToothConditionType } from "@prisma/client";
import type { TreatmentSuggestion } from "@/lib/ai";
import { ProcedureVisitPanel } from "@/components/clinical/procedure-visit-panel";
import type { ProcedureCatalog } from "@prisma/client";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

function updateClinicalUrl(patientId: string, appointmentId?: string) {
  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  if (appointmentId) params.set("appointmentId", appointmentId);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `/clinical?${qs}` : "/clinical");
}

export function ClinicalPageClient({
  patients,
  selectedPatientId,
  appointmentId,
  procedures,
  initialChartData,
  providerName,
  clinicName,
  templates,
}: {
  patients: { id: string; firstName: string; lastName: string; patientNumber: string }[];
  selectedPatientId?: string;
  appointmentId?: string;
  procedures: ProcedureCatalog[];
  initialChartData: ToothChartData;
  providerName?: string;
  clinicName?: string;
  templates: ClinicalTemplateOption[];
}) {
  const [patientId, setPatientId] = useState(selectedPatientId ?? "");
  const [chartData, setChartData] = useState<ToothChartData>(initialChartData);
  const [notation, setNotation] = useState<ChartNotation>("FDI");
  const [selectedTooth, setSelectedTooth] = useState<string>();
  const [highlightSurfaces, setHighlightSurfaces] = useState<ToothSurface[]>([]);
  const [rawNotes, setRawNotes] = useState("");
  const [soap, setSoap] = useState<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null>(null);
  const [soapLoading, setSoapLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [conditionSaving, setConditionSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoFromChart, setAutoFromChart] = useState(false);
  const [treatmentLoading, setTreatmentLoading] = useState(false);
  const [treatmentSuggestion, setTreatmentSuggestion] = useState<TreatmentSuggestion | null>(
    null,
  );
  const [savingTier, setSavingTier] = useState<"basic" | "premium" | null>(null);
  const loadRequestRef = useRef(0);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const patientDisplayName = selectedPatient
    ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
    : "";

  const chartSummary = useMemo(() => chartToSummary(chartData), [chartData]);

  const chartToothNumbers = useMemo(
    () => Object.keys(chartData).filter((t) => (chartData[t]?.conditions.length ?? 0) > 0),
    [chartData],
  );

  const selectedConditions = selectedTooth
    ? (chartData[selectedTooth]?.conditions ?? [])
    : [];

  const fetchChart = useCallback(
    async (id: string) => {
      const requestId = ++loadRequestRef.current;

      if (!id) {
        setPatientId("");
        setChartData({});
        setSelectedTooth(undefined);
        setSoap(null);
        setTreatmentSuggestion(null);
        setLoadError(null);
        setChartLoading(false);
        updateClinicalUrl("");
        return;
      }

      setChartLoading(true);
      setLoadError(null);
      setPatientId(id);
      setSelectedTooth(undefined);
      setHighlightSurfaces([]);
      setTreatmentSuggestion(null);

      try {
        const result = await loadPatientChart({ patientId: id });
        if (requestId !== loadRequestRef.current) return;

        if (result.success) {
          setChartData(result.data);
          setLoadError(null);
          updateClinicalUrl(id, appointmentId);
        } else {
          setChartData({});
          setLoadError(result.error);
        }
      } catch {
        if (requestId !== loadRequestRef.current) return;
        setChartData({});
        setLoadError(
          "Could not load the dental chart. Check your connection and try again.",
        );
      } finally {
        if (requestId === loadRequestRef.current) setChartLoading(false);
      }
    },
    [appointmentId],
  );

  useEffect(() => {
    if (!selectedPatientId) return;
    setPatientId(selectedPatientId);
    setChartData(initialChartData);
    setLoadError(null);
  }, [selectedPatientId, initialChartData]);

  function mergeConditionIntoChart(
    toothNumber: string,
    entry: {
      id: string;
      type: ToothConditionType;
      surfaces: string[];
      severity?: number | null;
      notes?: string | null;
      recordedAt: string;
      recordedBy?: string | null;
      recordedByName?: string | null;
    },
  ) {
    setChartData((prev) => {
      const existing = prev[toothNumber]?.conditions ?? [];
      return {
        ...prev,
        [toothNumber]: {
          conditions: [entry, ...existing.filter((c) => c.id !== entry.id)],
        },
      };
    });
  }

  async function handleAddCondition(toothNumber: string, input: AddConditionInput) {
    if (!patientId) return;
    setConditionSaving(true);
    const result = await createToothCondition({
      patientId,
      toothNumber,
      type: input.type,
      surfaces: input.surfaces,
      notes: input.notes,
      recordedAt: input.recordedAt,
      appointmentId,
    });
    setConditionSaving(false);

    if (result.success) {
      mergeConditionIntoChart(toothNumber, result.data);
      setHighlightSurfaces([]);
      toast.success(`${input.type.replace(/_/g, " ").toLowerCase()} added`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemoveCondition(conditionId: string) {
    if (!patientId || !selectedTooth) return;
    setConditionSaving(true);
    const result = await deleteToothCondition({ patientId, conditionId });
    setConditionSaving(false);

    if (result.success) {
      setChartData((prev) => {
        const tooth = prev[selectedTooth];
        if (!tooth) return prev;
        const conditions = tooth.conditions.filter((c) => c.id !== conditionId);
        const next = { ...prev };
        if (conditions.length === 0) {
          delete next[selectedTooth];
        } else {
          next[selectedTooth] = { conditions };
        }
        return next;
      });
      toast.success("Finding removed");
    } else {
      toast.error(result.error);
    }
  }

  async function handleMarkMissing() {
    if (!patientId || !selectedTooth) return;
    setConditionSaving(true);
    const result = await markToothMissing({ patientId, toothNumber: selectedTooth });
    setConditionSaving(false);
    if (result.success) {
      mergeConditionIntoChart(selectedTooth, result.data);
      toast.success("Tooth marked missing");
    } else {
      toast.error(result.error);
    }
  }

  async function handleRestoreTooth() {
    if (!patientId || !selectedTooth) return;
    setConditionSaving(true);
    const result = await restoreToothStatus({ patientId, toothNumber: selectedTooth });
    setConditionSaving(false);
    if (result.success) {
      setChartData((prev) => {
        const tooth = prev[selectedTooth];
        if (!tooth) return prev;
        const conditions = tooth.conditions.filter((c) => c.type !== "MISSING");
        const next = { ...prev };
        if (conditions.length === 0) {
          delete next[selectedTooth];
        } else {
          next[selectedTooth] = { conditions };
        }
        return next;
      });
      toast.success("Tooth restored");
    } else {
      toast.error(result.error);
    }
  }

  async function handleSuggestTreatment() {
    if (!patientId) return;
    setTreatmentLoading(true);
    setTreatmentSuggestion(null);
    const result = await aiSuggestTreatment({ patientId });
    setTreatmentLoading(false);
    if (result.success) {
      setTreatmentSuggestion(result.data);
      toast.success("Treatment options generated");
    } else {
      toast.error(result.error);
    }
  }

  async function handleSaveTreatmentTier(tier: "basic" | "premium") {
    if (!patientId || !treatmentSuggestion) return;
    const items = tier === "basic" ? treatmentSuggestion.basic : treatmentSuggestion.premium;
    setSavingTier(tier);
    const result = await saveSuggestedTreatmentPlan({
      patientId,
      title: tier === "basic" ? "Basic treatment plan" : "Premium treatment plan",
      description: treatmentSuggestion.rationale,
      aiSuggested: true,
      items,
    });
    setSavingTier(null);
    if (result.success) {
      toast.success(`${tier} plan saved — view under patient treatment plans`);
      setTreatmentSuggestion(null);
    } else {
      toast.error(result.error);
    }
  }

  const handleGenerateSoap = useCallback(
    async (opts: { rawNotes?: string; chartSummary?: string }) => {
      setSoapLoading(true);
      const result = await generateSoapNote({
        rawNotes: opts.rawNotes,
        chartSummary: opts.chartSummary ?? chartSummary,
      });
      setSoapLoading(false);
      if (result.success) {
        setSoap(result.data);
        toast.success("SOAP note generated — review before saving");
      } else {
        toast.error(result.error);
      }
    },
    [chartSummary],
  );

  const showChart = patientId && !loadError;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Clinical</h1>
            <p className="text-muted-foreground">
              Digital odontogram, charting & SOAP notes
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showChart && (
              <ChartExportButton
                chartData={chartData}
                notation={notation}
                patientName={patientDisplayName}
                clinicName={clinicName}
              />
            )}
            <Button variant="outline" size="sm" asChild>
              <a href="/clinical/treatment-plans">Treatment plans</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={patientId ? `/clinical/perio?patientId=${patientId}` : "/clinical/perio"}>
                Perio chart
              </a>
            </Button>
            {patientId && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/clinical/chairside?patientId=${patientId}${appointmentId ? `&appointmentId=${appointmentId}` : ""}`}>
                  Start chairside session
                </a>
              </Button>
            )}
            {patientId && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/clinical/radiographs?patientId=${patientId}`}>
                  Radiographs
                </a>
              </Button>
            )}
            {patientId && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/clinical/photos?patientId=${patientId}`}>
                  Clinical Photos
                </a>
              </Button>
            )}
          </div>
        </div>
        {appointmentId && showChart && (
          <Badge variant="secondary" className="mt-2">
            Linked to appointment
          </Badge>
        )}
      </div>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="clinical-patient">Patient</Label>
        <div className="relative">
          <select
            id="clinical-patient"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            value={patientId}
            disabled={chartLoading}
            onChange={(e) => void fetchChart(e.target.value)}
          >
            <option value="">Select patient...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.patientNumber})
              </option>
            ))}
          </select>
          {chartLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Unable to load chart</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchChart(patientId)}
            disabled={chartLoading || !patientId}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {showChart && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className={chartLoading ? "pointer-events-none opacity-50" : undefined}>
              <Odontogram
                data={chartData}
                notation={notation}
                selectedTooth={selectedTooth}
                highlightSurfaces={highlightSurfaces}
                onToothClick={(tooth) => {
                  setSelectedTooth(tooth);
                  setHighlightSurfaces([]);
                }}
                onNotationChange={setNotation}
                disabled={chartLoading || conditionSaving}
              />
            </div>

            <ChartHistoryTimeline
              chartData={chartData}
              notation={notation}
              patientName={patientDisplayName}
              filterTooth={selectedTooth}
            />

            <TreatmentSuggestionsPanel
              suggestion={treatmentSuggestion}
              loading={treatmentLoading}
              savingTier={savingTier}
              onSaveTier={(tier) => void handleSaveTreatmentTier(tier)}
              onDismiss={() => setTreatmentSuggestion(null)}
            />

            <ClinicalNoteEditor
              patientId={patientId}
              appointmentId={appointmentId}
              providerName={providerName}
              templates={templates}
              chartSummary={chartSummary}
              toothNumbers={chartToothNumbers}
              rawNotes={rawNotes}
              onRawNotesChange={setRawNotes}
              soap={soap}
              onSoapChange={setSoap}
              onGenerate={handleGenerateSoap}
              generating={soapLoading}
              disabled={chartLoading}
              autoFromChart={autoFromChart}
              onAutoFromChartChange={setAutoFromChart}
            />

            {patientId && (
              <ProcedureVisitPanel
                patientId={patientId}
                appointmentId={appointmentId}
                procedures={procedures}
              />
            )}
          </div>

          <div className="space-y-4">
            {selectedTooth ? (
              <ToothDetailPanel
                fdiNumber={selectedTooth}
                notation={notation}
                conditions={selectedConditions}
                providerName={providerName}
                onClose={() => {
                  setSelectedTooth(undefined);
                  setHighlightSurfaces([]);
                }}
                onAddCondition={(input) => handleAddCondition(selectedTooth, input)}
                onRemoveCondition={handleRemoveCondition}
                onMarkMissing={handleMarkMissing}
                onRestoreTooth={handleRestoreTooth}
                onSuggestTreatment={() => void handleSuggestTreatment()}
                onSurfacesChange={setHighlightSurfaces}
                treatmentLoading={treatmentLoading}
                saving={conditionSaving}
              />
            ) : (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base text-muted-foreground">
                    Tooth detail
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Click any tooth on the odontogram to record findings by surface,
                  add quick conditions, and link to AI treatment suggestions.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
