"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EncounterPatientHeader } from "@/components/clinical/encounter-patient-header";
import {
  TreatmentPlanInlinePanel,
  type ChairsideTreatmentPlan,
} from "@/components/clinical/treatment-plan-inline-panel";
import { PerioPageClient } from "@/app/(dashboard)/clinical/perio/perio-client";
import RadiographPageClient from "@/app/(dashboard)/clinical/radiographs/radiograph-client";
import PhotoPageClient from "@/app/(dashboard)/clinical/photos/photo-client";
import { EncounterChartTab } from "./encounter-chart-tab";
import type { ChairsideEntryRow } from "@/components/clinical/chairside-panel";
import type { ProcedureLineRow } from "@/app/(dashboard)/features/procedure-lines/actions";
import type { ProcedureOption } from "@/lib/clinical/use-procedure-search";
import type { EncounterTab } from "@/lib/clinical/encounter-url";
import type { PerioChartRecord } from "@/components/clinical/perio-chart-history";
import type { ImageRecord } from "@/components/clinical/image-gallery";
import type { PerioMeasurement } from "@/lib/clinical/types";
import type { OutstandingPlanItem } from "@/components/clinical/procedure-lines-panel";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import type { PatientVisitHistoryRow } from "@/lib/clinical/load-patient-visit-history";
import Link from "next/link";

type PhotoRecord = ImageRecord & {
  photoCategory: string | null;
  isBeforePhoto: boolean;
  afterImageId: string | null;
};

type Props = {
  canWrite: boolean;
  countryCode: string;
  currentStaffMemberId: string | null;
  initialTab: EncounterTab;
  appointment: {
    id: string;
    ref: string | null;
    startTime: string;
    status: string;
    chairName: string | null;
    doctorName: string | null;
  };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
    dateOfBirth: string | null;
    photoUrl: string | null;
    allergies: string[];
    bloodGroup: string | null;
    medicalHistory: string | null;
  };
  session: {
    id: string;
    patientId: string;
    appointmentId: string;
    entries: ChairsideEntryRow[];
    notes?: string | null;
  } | null;
  initialChartData: ToothChartData;
  visitHistory: PatientVisitHistoryRow[];
  procedureLines: ProcedureLineRow[];
  treatmentPlans: ChairsideTreatmentPlan[];
  outstandingPlanItems: OutstandingPlanItem[];
  procedures: ProcedureOption[];
  perio: {
    chartHistory: PerioChartRecord[];
    currentStaffId: string | null;
    currentStaffName: string;
  };
  radiographs: ImageRecord[];
  photos: {
    items: PhotoRecord[];
    presentations: {
      id: string;
      title: string;
      description: string | null;
      imageIds: string[];
      shareToken: string | null;
      viewCount: number;
      createdAt: string;
    }[];
  };
  emergencies: {
    id: string;
    chiefComplaint: string;
    painScore: number;
    triageLevel: string;
    status: string;
    createdAt: string;
  }[];
};

const TAB_LABELS: Record<EncounterTab, string> = {
  chart: "Chart",
  perio: "Periodontal",
  radiographs: "Radiographs",
  photos: "Photos",
  "treatment-plan": "Treatment Plan",
  emergency: "Emergency",
};

export function EncounterWorkspaceClient(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<EncounterTab>(props.initialTab);

  const patientLabel = `${props.patient.firstName} ${props.patient.lastName}`.trim();
  const showEmergencyTab = props.emergencies.length > 0;

  const syncTab = useCallback(
    (next: EncounterTab) => {
      setTab(next);
      const params = new URLSearchParams(window.location.search);
      if (next === "chart") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(
        `/clinical/encounter/${props.appointment.id}${qs ? `?${qs}` : ""}`,
        { scroll: false },
      );
    },
    [props.appointment.id, router],
  );

  function handleFinalized(invoiceId: string | null) {
    setTimeout(() => {
      router.push(invoiceId ? "/billing" : "/appointments");
      router.refresh();
    }, 2000);
  }

  const patientOption = [
    {
      id: props.patient.id,
      firstName: props.patient.firstName,
      lastName: props.patient.lastName,
    },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <EncounterPatientHeader patient={props.patient} appointment={props.appointment} />

      <Tabs
        value={tab}
        onValueChange={(v) => syncTab(v as EncounterTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b px-4">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0 py-2">
            {(Object.keys(TAB_LABELS) as EncounterTab[])
              .filter((t) => t !== "emergency" || showEmergencyTab)
              .map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="data-[state=active]:bg-muted"
                >
                  {t === "emergency" ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Emergency
                    </span>
                  ) : (
                    TAB_LABELS[t]
                  )}
                </TabsTrigger>
              ))}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <TabsContent value="chart" className="mt-0 space-y-4">
            {!props.session ? (
              <p className="text-sm text-muted-foreground">
                No active chart session. A clinician must start treatment to chart live entries.
              </p>
            ) : (
              <EncounterChartTab
                canWrite={props.canWrite}
                countryCode={props.countryCode}
                currentStaffMemberId={props.currentStaffMemberId}
                patientId={props.patient.id}
                patientName={patientLabel}
                appointmentId={props.appointment.id}
                session={props.session}
                initialChartData={props.initialChartData}
                procedureLines={props.procedureLines}
                treatmentPlans={props.treatmentPlans}
                outstandingPlanItems={props.outstandingPlanItems}
                procedures={props.procedures}
                visitHistory={props.visitHistory}
                onOpenPlanTab={() => syncTab("treatment-plan")}
                onFinalized={handleFinalized}
              />
            )}
          </TabsContent>

          <TabsContent value="perio" className="mt-0">
            <PerioPageClient
              embedded
              canWriteClinical={props.canWrite}
              patients={patientOption}
              selectedPatientId={props.patient.id}
              chartHistory={props.perio.chartHistory}
              currentStaffId={props.perio.currentStaffId}
              currentStaffName={props.perio.currentStaffName}
            />
          </TabsContent>

          <TabsContent value="radiographs" className="mt-0">
            <RadiographPageClient
              embedded
              canWriteClinical={props.canWrite}
              patients={patientOption}
              selectedPatientId={props.patient.id}
              images={props.radiographs}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-0">
            <PhotoPageClient
              embedded
              canWriteClinical={props.canWrite}
              patients={patientOption}
              selectedPatientId={props.patient.id}
              appointmentId={props.appointment.id}
              photos={props.photos.items}
              presentations={props.photos.presentations}
              defaultTab="gallery"
            />
          </TabsContent>

          <TabsContent value="treatment-plan" className="mt-0">
            <TreatmentPlanInlinePanel
              patientId={props.patient.id}
              appointmentId={props.appointment.id}
              canWrite={props.canWrite}
              countryCode={props.countryCode}
              procedures={props.procedures}
              treatmentPlans={props.treatmentPlans}
            />
          </TabsContent>

          {showEmergencyTab ? (
            <TabsContent value="emergency" className="mt-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Active emergency intake for this patient during today&apos;s visit.
              </p>
              <ul className="space-y-2">
                {props.emergencies.map((e) => (
                  <li key={e.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">{e.triageLevel}</Badge>
                      <Badge variant="secondary">{e.status}</Badge>
                      <span className="text-muted-foreground">
                        Pain {e.painScore}/10 ·{" "}
                        {new Date(e.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">{e.chiefComplaint}</p>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/clinical/emergency?patientId=${props.patient.id}`}>
                  Open emergency module
                </Link>
              </Button>
            </TabsContent>
          ) : null}
        </div>
      </Tabs>
    </div>
  );
}
