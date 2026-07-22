"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanLine, UserCheck } from "lucide-react";
import { useBarcodeScanner } from "@/lib/ids/use-barcode-scanner";
import {
  lookupByBarcode,
  checkinByBarcode,
} from "@/app/(dashboard)/features/patients/barcode-actions";
import { InsuranceVerificationForm } from "@/components/reception/insurance-verification-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type ScanResult = Awaited<ReturnType<typeof lookupByBarcode>>;

export function QuickScan({
  spineEnabled = false,
  canVerifyInsurance = false,
}: {
  spineEnabled?: boolean;
  canVerifyInsurance?: boolean;
}) {
  const router = useRouter();
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setShowInsurance(false);
    try {
      const data = await lookupByBarcode(code);
      setResult(data);
      if (!data) toast.error("Patient not found");
      else toast.success(`Found: ${data.firstName} ${data.lastName}`);
      if (data?.appointment?.status === "ARRIVED" && spineEnabled && canVerifyInsurance) {
        setShowInsurance(true);
      }
    } catch {
      toast.error("Scan lookup failed");
    } finally {
      setLoading(false);
    }
  }, [spineEnabled, canVerifyInsurance]);

  useBarcodeScanner(handleScan);

  async function handleCheckIn() {
    if (!result?.appointment || !result.patientId) return;
    setCheckingIn(true);
    try {
      await checkinByBarcode(result.patientId, result.appointment.id);
      toast.success("Patient checked in");
      setResult({
        ...result,
        appointment: { ...result.appointment, status: "ARRIVED" },
      });
      if (spineEnabled && canVerifyInsurance) {
        setShowInsurance(true);
      }
      router.refresh();
    } catch {
      toast.error("Check-in failed");
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="h-5 w-5" />
          Quick scan check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleScan(manualCode);
          }}
        >
          <Input
            className="font-mono"
            placeholder="Scan or enter patient ID / barcode..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={loading}>
            Lookup
          </Button>
        </form>

        {result && (
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">
                  {result.firstName} {result.lastName}
                </div>
                <div className="font-mono text-sm text-muted-foreground">{result.patientId}</div>
                {result.phone && <div className="text-sm">{result.phone}</div>}
                {result.bloodGroup && (
                  <Badge variant="destructive" className="mt-2">
                    {result.bloodGroup}
                  </Badge>
                )}
              </div>
              {result.appointment ? (
                <div className="text-right text-sm">
                  <div className="font-medium">{result.appointment.doctorName}</div>
                  <div>{formatDate(result.appointment.startTime)}</div>
                  <Badge className="mt-1">{result.appointment.status}</Badge>
                  {result.appointment.status !== "ARRIVED" && (
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => void handleCheckIn()}
                      disabled={checkingIn}
                    >
                      <UserCheck className="mr-1 h-4 w-4" />
                      Check in
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No appointment today</div>
              )}
            </div>

            {showInsurance && result.appointment && spineEnabled && canVerifyInsurance && (
              <div className="mt-4 border-t pt-4">
                <InsuranceVerificationForm
                  appointmentId={result.appointment.id}
                  patientName={`${result.firstName} ${result.lastName}`}
                  onComplete={() => {
                    setShowInsurance(false);
                    router.refresh();
                  }}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
