"use client";

import { useRouter } from "next/navigation";
import { ChairsidePanel, type ChairsideEntryRow } from "@/components/clinical/chairside-panel";
import type { ProcedureOption } from "@/lib/clinical/use-procedure-search";

type Props = {
  session: {
    id: string;
    patientId: string;
    appointmentId: string | null;
    entries: ChairsideEntryRow[];
  };
  patient: { id: string; firstName: string; lastName: string };
  procedures: ProcedureOption[];
};

export default function ChairsidePageClient({ session, patient, procedures }: Props) {
  const router = useRouter();

  function handleFinalized(invoiceId: string | null) {
    setTimeout(() => {
      router.push(invoiceId ? "/billing" : "/appointments");
      router.refresh();
    }, 2000);
  }

  return (
    <ChairsidePanel
      sessionId={session.id}
      patientName={`${patient.firstName} ${patient.lastName}`}
      appointmentId={session.appointmentId ?? undefined}
      initialEntries={session.entries}
      procedures={procedures}
      onFinalized={handleFinalized}
    />
  );
}
