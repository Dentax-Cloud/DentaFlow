"use client";

import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Odontogram } from "@/components/clinical/dental-chart";
import { ChartHistoryTimeline } from "@/components/clinical/chart-history-timeline";
import { ChairsidePanel, type ChairsideEntryRow } from "@/components/clinical/chairside-panel";
import {
  ProcedureLinesPanel,
  type OutstandingPlanItem,
} from "@/components/clinical/procedure-lines-panel";
import { ActivePlanSummaryStrip } from "@/components/clinical/active-plan-summary-strip";
import { EncounterVisitHistoryPanel } from "@/components/clinical/encounter-visit-history-panel";
import { loadPatientChart } from "@/app/(dashboard)/features/clinical/actions";
import type { ProcedureLineRow } from "@/app/(dashboard)/features/procedure-lines/actions";
import type { ProcedureOption } from "@/lib/clinical/use-procedure-search";
import type { ChairsideTreatmentPlan } from "@/components/clinical/treatment-plan-inline-panel";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import type { ChartNotation } from "@/lib/clinical/odontogram-notation";
import type { PatientVisitHistoryRow } from "@/lib/clinical/load-patient-visit-history";

type Props = {
  canWrite: boolean;
  countryCode: string;
  timezone?: string | null;
  currentStaffMemberId: string | null;
  patientId: string;
  patientName: string;
  appointmentId: string;
  session: {
    id: string;
    entries: ChairsideEntryRow[];
    notes?: string | null;
  };
  initialChartData: ToothChartData;
  procedureLines: ProcedureLineRow[];
  treatmentPlans: ChairsideTreatmentPlan[];
  outstandingPlanItems: OutstandingPlanItem[];
  procedures: ProcedureOption[];
  visitHistory: PatientVisitHistoryRow[];
  onOpenPlanTab: () => void;
  onFinalized: (invoiceId: string | null) => void;
};

export function EncounterChartTab({
  canWrite,
  countryCode,
  timezone,
  currentStaffMemberId,
  patientId,
  patientName,
  appointmentId,
  session,
  initialChartData,
  procedureLines,
  treatmentPlans,
  outstandingPlanItems,
  procedures,
  visitHistory,
  onOpenPlanTab,
  onFinalized,
}: Props) {
  const [chartData, setChartData] = useState<ToothChartData>(initialChartData);
  const [notation, setNotation] = useState<ChartNotation>("FDI");
  const [selectedToothFdi, setSelectedToothFdi] = useState<string | undefined>();
  const [chartLoading, setChartLoading] = useState(false);

  const refreshChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const result = await loadPatientChart({ patientId });
      if (result.success) setChartData(result.data);
    } finally {
      setChartLoading(false);
    }
  }, [patientId]);

  return (
    <div className="space-y-4">
      <ProcedureLinesPanel
        appointmentId={appointmentId}
        countryCode={countryCode}
        currentStaffMemberId={currentStaffMemberId}
        canWrite={canWrite}
        initialLines={procedureLines}
        procedures={procedures}
        outstandingPlanItems={outstandingPlanItems}
      />

      <ActivePlanSummaryStrip
        treatmentPlans={treatmentPlans}
        outstandingPlanItems={outstandingPlanItems}
        onOpenPlanTab={onOpenPlanTab}
      />

      <div className={chartLoading ? "pointer-events-none opacity-60" : undefined}>
        <Odontogram
          data={chartData}
          notation={notation}
          selectedTooth={selectedToothFdi}
          onToothClick={(tooth) => {
            setSelectedToothFdi((current) => (current === tooth ? undefined : tooth));
          }}
          onNotationChange={setNotation}
          disabled={!canWrite || chartLoading}
        />
      </div>

      <ChairsidePanel
        canWrite={canWrite}
        countryCode={countryCode}
        sessionId={session.id}
        patientName={patientName}
        appointmentId={appointmentId}
        initialEntries={session.entries}
        initialSessionNotes={session.notes}
        procedures={procedures}
        onFinalized={onFinalized}
        hidePatientBanner
        hideToothInput
        selectedToothFdi={selectedToothFdi ?? null}
        onSelectedToothFdiChange={(fdi) => setSelectedToothFdi(fdi ?? undefined)}
        chartNotation={notation}
        onEntryAdded={refreshChart}
      />

      <details className="group rounded-lg border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>Clinical history</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-4">
          <ChartHistoryTimeline
            chartData={chartData}
            notation={notation}
            patientName={patientName}
            filterTooth={selectedToothFdi}
            timezone={timezone}
          />
        </div>
      </details>

      <EncounterVisitHistoryPanel visits={visitHistory} timezone={timezone} />
    </div>
  );
}
