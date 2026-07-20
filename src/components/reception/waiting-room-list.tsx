"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { InsuranceVerificationForm } from "@/components/reception/insurance-verification-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type WaitingRoomPatient = {
  id: string;
  patientName: string;
  patientIdLabel: string;
  chairName: string | null;
  hasInsuranceVerification: boolean;
};

export function WaitingRoomList({
  patients,
  spineEnabled,
  canVerifyInsurance,
}: {
  patients: WaitingRoomPatient[];
  spineEnabled: boolean;
  canVerifyInsurance: boolean;
}) {
  const router = useRouter();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waiting room</CardTitle>
        <p className="text-sm text-muted-foreground">
          Patients checked in and waiting to be seen
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {patients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No patients waiting</p>
        ) : (
          patients.map((apt) => (
            <div
              key={apt.id}
              className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{apt.patientName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {apt.patientIdLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Chair: {apt.chairName ?? "Unassigned"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800">ARRIVED</Badge>
                  {apt.hasInsuranceVerification ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-800">
                      Insurance verified
                    </Badge>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    {spineEnabled && canVerifyInsurance && !apt.hasInsuranceVerification ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setVerifyingId((id) => (id === apt.id ? null : apt.id))
                        }
                      >
                        <ShieldCheck className="mr-1 h-4 w-4" />
                        Verify insurance
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/appointments?appointmentId=${apt.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              </div>
              {verifyingId === apt.id && spineEnabled && canVerifyInsurance ? (
                <div className="mt-3 border-t border-yellow-200 pt-3">
                  <InsuranceVerificationForm
                    appointmentId={apt.id}
                    patientName={apt.patientName}
                    compact
                    onComplete={() => {
                      setVerifyingId(null);
                      router.refresh();
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
