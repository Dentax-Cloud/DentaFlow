"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPreAuthorization,
  generateEstimatePdf,
  generateTreatmentEstimate,
  recordPreAuthDecision,
  submitPreAuthorization,
} from "@/app/(dashboard)/features/insurance/treatment-estimate-actions";
import {
  isPreAuthApproved,
  type SerializedPreAuthorization,
  type SerializedTreatmentEstimate,
} from "@/lib/insurance/estimate-types";
import { PreAuthStatusBadge } from "@/components/insurance/pre-auth-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PolicyOption = {
  id: string;
  rank: string;
  memberId: string;
  providerName: string;
};

type Props = {
  patientId: string;
  treatmentPlanId: string;
  estimate: SerializedTreatmentEstimate | null;
  preAuth: SerializedPreAuthorization | null;
  policies: PolicyOption[];
  preAuthDefaultRequired: boolean;
  currencyCode?: string;
};

export function TreatmentEstimatePanel({
  patientId,
  treatmentPlanId,
  estimate,
  preAuth,
  policies,
  preAuthDefaultRequired,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [referenceNumber, setReferenceNumber] = useState(preAuth?.referenceNumber ?? "");
  const [selectedPolicyId, setSelectedPolicyId] = useState(
    estimate?.policyId ?? policies[0]?.id ?? "",
  );
  const [showDecision, setShowDecision] = useState(false);

  const hasInsurance = policies.length > 0 || (estimate?.policyId != null);
  const preAuthSatisfied = preAuth ? isPreAuthApproved(preAuth.status) : false;
  const needsPreAuth =
    preAuthDefaultRequired && hasInsurance && estimate != null && !preAuthSatisfied;

  function handleGenerateEstimate() {
    startTransition(async () => {
      try {
        await generateTreatmentEstimate(patientId, treatmentPlanId);
        toast.success("Treatment estimate generated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not generate estimate");
      }
    });
  }

  function handleDownloadPdf() {
    if (!estimate) return;
    startTransition(async () => {
      try {
        const result = await generateEstimatePdf(estimate.id);
        window.open(result.pdfUrl, "_blank");
        toast.success("Estimate PDF ready");
        router.refresh();
      } catch {
        toast.error("Could not generate PDF");
      }
    });
  }

  function handleCreatePreAuth() {
    if (!estimate || !selectedPolicyId) {
      toast.error("Select an insurance policy first");
      return;
    }
    startTransition(async () => {
      try {
        await createPreAuthorization(estimate.id, selectedPolicyId);
        toast.success("Pre-authorization draft created");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create pre-authorization");
      }
    });
  }

  function handleSubmitPreAuth() {
    if (!preAuth) return;
    startTransition(async () => {
      try {
        await submitPreAuthorization(preAuth.id, referenceNumber);
        toast.success("Pre-authorization submitted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not submit pre-authorization");
      }
    });
  }

  function handleDecision(
    status: "APPROVED" | "PARTIALLY_APPROVED" | "DENIED",
    denialReason?: string,
  ) {
    if (!preAuth || !estimate) return;
    startTransition(async () => {
      try {
        await recordPreAuthDecision(
          preAuth.id,
          status,
          status !== "DENIED"
            ? {
                insurerAmount: estimate.estimatedInsurerAmount,
                patientAmount: estimate.estimatedPatientAmount,
              }
            : undefined,
          denialReason,
        );
        toast.success(`Pre-authorization marked ${status.toLowerCase().replace("_", " ")}`);
        setShowDecision(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not record decision");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Insurance estimate & pre-authorization</CardTitle>
          <div className="flex items-center gap-2">
            {preAuth && <PreAuthStatusBadge status={preAuth.status} />}
            {needsPreAuth && (
              <Badge variant="destructive">Pre-auth required before start</Badge>
            )}
            {!preAuthDefaultRequired && hasInsurance && (
              <Badge variant="outline">Pre-auth optional</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!estimate ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a cost estimate from your fee schedule before presenting the plan or
              requesting pre-authorization.
            </p>
            <Button size="sm" onClick={handleGenerateEstimate} disabled={isPending}>
              Generate estimate
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold tabular-nums">
                  {estimate.totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Insurer portion</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-700">
                  {estimate.estimatedInsurerAmount.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Patient portion</p>
                <p className="text-lg font-semibold tabular-nums text-orange-700">
                  {estimate.estimatedPatientAmount.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerateEstimate} disabled={isPending}>
                Regenerate estimate
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={isPending}>
                Download PDF
              </Button>
            </div>

            {hasInsurance && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Pre-authorization</p>
                {!preAuth ? (
                  <>
                    {policies.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="policy-select">Insurance policy</Label>
                        <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                          <SelectTrigger id="policy-select">
                            <SelectValue placeholder="Select policy" />
                          </SelectTrigger>
                          <SelectContent>
                            {policies.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.rank} — {p.providerName} ({p.memberId})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button size="sm" onClick={handleCreatePreAuth} disabled={isPending}>
                      Request pre-authorization
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    {preAuth.status === "DRAFT" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="ref-number">Insurer reference number</Label>
                          <Input
                            id="ref-number"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="e.g. PA-2026-001234"
                          />
                        </div>
                        <Button size="sm" onClick={handleSubmitPreAuth} disabled={isPending}>
                          Submit to insurer
                        </Button>
                      </>
                    )}
                    {preAuth.status === "SUBMITTED" && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Reference: {preAuth.referenceNumber ?? "—"}
                        </p>
                        {!showDecision ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowDecision(true)}
                          >
                            Record insurer decision
                          </Button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleDecision("APPROVED")}
                              disabled={isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDecision("PARTIALLY_APPROVED")}
                              disabled={isPending}
                            >
                              Partial approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                const reason = prompt("Denial reason (optional):");
                                handleDecision("DENIED", reason ?? undefined);
                              }}
                              disabled={isPending}
                            >
                              Deny
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                    {(preAuth.status === "APPROVED" ||
                      preAuth.status === "PARTIALLY_APPROVED") && (
                      <p className="text-sm text-emerald-700">
                        Approved — treatment can proceed
                        {preAuth.approvedInsurerAmount != null && (
                          <>
                            {" "}
                            (insurer: {preAuth.approvedInsurerAmount.toFixed(2)}, patient:{" "}
                            {preAuth.approvedPatientAmount?.toFixed(2) ?? "—"})
                          </>
                        )}
                      </p>
                    )}
                    {preAuth.status === "DENIED" && (
                      <p className="text-sm text-destructive">
                        Denied{preAuth.denialReason ? `: ${preAuth.denialReason}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!hasInsurance && (
              <p className="text-sm text-muted-foreground">
                Self-pay patient — full amount is patient responsibility. No pre-authorization
                needed.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
