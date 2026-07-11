"use client";

import { useRouter } from "next/navigation";
import { ChairsidePanel, type ChairsideEntryRow } from "@/components/clinical/chairside-panel";
import { ProcedureLinesPanel, type OutstandingPlanItem } from "@/components/clinical/procedure-lines-panel";
import {
  TreatmentPlanInlinePanel,
  type ChairsideTreatmentPlan,
} from "@/components/clinical/treatment-plan-inline-panel";
import type { ProcedureLineRow } from "@/app/(dashboard)/features/procedure-lines/actions";
import type { ProcedureOption } from "@/lib/clinical/use-procedure-search";

type Props = {
  canWrite?: boolean;
  countryCode: string;
  currentStaffMemberId: string | null;
  procedureLines: ProcedureLineRow[];
  treatmentPlans: ChairsideTreatmentPlan[];
  outstandingPlanItems: OutstandingPlanItem[];
  session: {
    id: string;
    patientId: string;
    appointmentId: string | null;
    entries: ChairsideEntryRow[];
    notes?: string | null;
  };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    allergies: string[];
    bloodGroup: string | null;
    medicalHistory: string | null;
  };
  procedures: ProcedureOption[];
};

export default function ChairsidePageClient({
  canWrite = true,
  countryCode,
  currentStaffMemberId,
  procedureLines,
  treatmentPlans,
  outstandingPlanItems,
  session,
  patient,
  procedures,
}: Props) {
  const router = useRouter();

  function handleFinalized(invoiceId: string | null) {
    setTimeout(() => {
      router.push(invoiceId ? "/billing" : "/appointments");
      router.refresh();
    }, 2000);
  }

  return (
    <div className="space-y-0">
      <TreatmentPlanInlinePanel
        patientId={patient.id}
        appointmentId={session.appointmentId}
        canWrite={canWrite}
        countryCode={countryCode}
        procedures={procedures}
        treatmentPlans={treatmentPlans}
      />
      {session.appointmentId ? (
        <ProcedureLinesPanel
          appointmentId={session.appointmentId}
          countryCode={countryCode}
          currentStaffMemberId={currentStaffMemberId}
          canWrite={canWrite}
          initialLines={procedureLines}
          procedures={procedures}
          outstandingPlanItems={outstandingPlanItems}
        />
      ) : null}
      <ChairsidePanel
        canWrite={canWrite}
        countryCode={countryCode}
        sessionId={session.id}
        patientName={`${patient.firstName} ${patient.lastName}`}
        patientAllergies={patient.allergies}
        patientBloodGroup={patient.bloodGroup}
        patientMedicalHistory={patient.medicalHistory}
        appointmentId={session.appointmentId ?? undefined}
        initialEntries={session.entries}
        initialSessionNotes={session.notes}
        procedures={procedures}
        onFinalized={handleFinalized}
      />
    </div>
  );
}
