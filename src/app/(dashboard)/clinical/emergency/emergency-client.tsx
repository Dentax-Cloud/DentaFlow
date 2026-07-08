"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmergencyIntakeForm } from "@/components/clinical/emergency-intake-form";
import { EmergencyQueue } from "@/components/clinical/emergency-queue";

type Props = {
  canWriteEmergency?: boolean;
  patients: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    allergies?: string[] | null;
    medications?: string[] | null;
  }[];
  intakes: {
    id: string;
    patientId: string;
    chiefComplaint: string;
    painScore: number;
    triageLevel: string;
    status: string;
    clinicalNote: string | null;
    createdAt: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    };
  }[];
  selectedIntakeId: string | null;
  defaultTab: string;
  date: string;
};

export default function EmergencyPageClient({
  canWriteEmergency = true,
  patients,
  intakes,
  selectedIntakeId,
  defaultTab,
  date,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(selectedIntakeId ? "queue" : defaultTab);

  const waitingCount = intakes.filter((i) => i.status === "WAITING").length;
  const immediateCount = intakes.filter(
    (i) => i.triageLevel === "IMMEDIATE" && !["COMPLETED", "REFERRED"].includes(i.status),
  ).length;

  function handleDateChange(newDate: string) {
    router.push(`/clinical/emergency?date=${newDate}`);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">🚨 Emergency</h1>
            {immediateCount > 0 && (
              <Badge className="animate-pulse bg-red-600 text-white">
                {immediateCount} IMMEDIATE
              </Badge>
            )}
            {waitingCount > 0 && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                {waitingCount} waiting
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Emergency queue and triage management
          </p>
        </div>

        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue">
            Queue
            {waitingCount > 0 && (
              <Badge className="ml-2 bg-yellow-500 px-1.5 text-xs text-white">
                {waitingCount}
              </Badge>
            )}
          </TabsTrigger>
          {canWriteEmergency ? <TabsTrigger value="new">+ New intake</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="queue" className="mt-6">
          <EmergencyQueue
            intakes={intakes}
            canWrite={canWriteEmergency}
            selectedIntakeId={selectedIntakeId}
          />
        </TabsContent>

        {canWriteEmergency ? (
        <TabsContent value="new" className="mt-6">
          <EmergencyIntakeForm
            patients={patients}
            onCreated={(id) => {
              setActiveTab("queue");
              router.push(`/clinical/emergency?intakeId=${id}`);
              router.refresh();
            }}
          />
        </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
