"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { upsertFrontOfficeInsuranceVerification } from "@/app/(dashboard)/features/reception/insurance-verification-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ELIGIBILITY_OPTIONS = [
  { value: "eligible", label: "Eligible" },
  { value: "ineligible", label: "Ineligible" },
  { value: "unknown", label: "Unknown" },
  { value: "pending", label: "Pending" },
] as const;

const PRE_AUTH_OPTIONS = [
  { value: "not_required", label: "Not required" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "expired", label: "Expired" },
] as const;

export type InsuranceVerificationFormProps = {
  appointmentId: string;
  patientName: string;
  onComplete?: () => void;
  compact?: boolean;
};

export function InsuranceVerificationForm({
  appointmentId,
  patientName,
  onComplete,
  compact = false,
}: InsuranceVerificationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [eligibilityStatus, setEligibilityStatus] = useState<string>("eligible");
  const [preAuthStatus, setPreAuthStatus] = useState<string>("not_required");
  const [estimatedCoverage, setEstimatedCoverage] = useState("");
  const [estimatedCopay, setEstimatedCopay] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const coverage =
          estimatedCoverage.trim() === "" ? undefined : Number(estimatedCoverage);
        const copay = estimatedCopay.trim() === "" ? undefined : Number(estimatedCopay);
        if (coverage != null && Number.isNaN(coverage)) {
          toast.error("Estimated coverage must be a number");
          return;
        }
        if (copay != null && Number.isNaN(copay)) {
          toast.error("Estimated copay must be a number");
          return;
        }

        await upsertFrontOfficeInsuranceVerification({
          appointmentId,
          eligibilityStatus,
          preAuthStatus,
          estimatedCoverage: coverage,
          estimatedCopay: copay,
        });
        toast.success(`Insurance verified for ${patientName}`);
        onComplete?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        toast.error(message);
      }
    });
  }

  const body = (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Pre-visit verification for <span className="font-medium text-foreground">{patientName}</span>.
          Does not require clinical risk clearance.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`elig-${appointmentId}`}>Eligibility</Label>
          <select
            id={`elig-${appointmentId}`}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={eligibilityStatus}
            onChange={(e) => setEligibilityStatus(e.target.value)}
            disabled={isPending}
          >
            {ELIGIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`preauth-${appointmentId}`}>Pre-authorization</Label>
          <select
            id={`preauth-${appointmentId}`}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={preAuthStatus}
            onChange={(e) => setPreAuthStatus(e.target.value)}
            disabled={isPending}
          >
            {PRE_AUTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cov-${appointmentId}`}>Est. coverage</Label>
          <Input
            id={`cov-${appointmentId}`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={estimatedCoverage}
            onChange={(e) => setEstimatedCoverage(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`copay-${appointmentId}`}>Est. copay</Label>
          <Input
            id={`copay-${appointmentId}`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={estimatedCopay}
            onChange={(e) => setEstimatedCopay(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        <ShieldCheck className="mr-1 h-4 w-4" />
        {isPending ? "Saving…" : "Save insurance verification"}
      </Button>
    </form>
  );

  if (compact) return body;

  return (
    <Card className="border-sky-200 bg-sky-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-sky-700" />
          Insurance verification
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
