"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  CLAIM_KANBAN_COLUMNS,
  type ClaimProcedureSnapshotLine,
} from "@/lib/insurance/claim-types";
import type { SerializedClaim } from "@/lib/insurance/serialize-claim";
import {
  appealClaim,
  createClaimFromInvoice,
  markClaimInReview,
  markClaimPaid,
  recordClaimDecision,
  submitClaim,
  writeOffClaim,
} from "@/app/(dashboard)/features/insurance/claim-actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClaimableInvoice = {
  id: string;
  invoiceNumber: string;
  patientName: string;
  patientId: string;
  insuranceAmount: number;
  total: number;
  createdAt: string;
};

type Props = {
  claims: SerializedClaim[];
  claimableInvoices: ClaimableInvoice[];
  currency?: string;
};

function ClaimCard({
  claim,
  onSelect,
}: {
  claim: SerializedClaim;
  onSelect: (claim: SerializedClaim) => void;
}) {
  const patientName = claim.patient
    ? `${claim.patient.firstName} ${claim.patient.lastName}`
    : "Unknown patient";

  return (
    <button
      type="button"
      onClick={() => onSelect(claim)}
      className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/50"
    >
      <p className="text-sm font-medium leading-tight">{patientName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatCurrency(claim.submittedAmount)}
      </p>
      {claim.daysSinceSubmission != null && claim.submittedAt && (
        <p className="mt-1 text-xs text-muted-foreground">
          {claim.daysSinceSubmission}d since submission
        </p>
      )}
      {claim.status === "PARTIALLY_APPROVED" && claim.approvedAmount != null && (
        <Badge variant="secondary" className="mt-2 text-xs">
          Approved {formatCurrency(claim.approvedAmount)}
        </Badge>
      )}
    </button>
  );
}

function ProcedureTable({ lines }: { lines: ClaimProcedureSnapshotLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No procedure snapshot</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="p-2">Code</th>
            <th className="p-2">Description</th>
            <th className="p-2 text-right">Qty</th>
            <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={`${line.procedureCode ?? "line"}-${i}`} className="border-t">
              <td className="p-2 font-mono text-xs">{line.procedureCode ?? "—"}</td>
              <td className="p-2">{line.description}</td>
              <td className="p-2 text-right">{line.quantity}</td>
              <td className="p-2 text-right">{formatCurrency(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClaimsClient({ claims, claimableInvoices }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SerializedClaim | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [denialReason, setDenialReason] = useState("");

  useEffect(() => {
    const claimId = searchParams.get("claimId");
    if (!claimId) return;
    const match = claims.find((c) => c.id === claimId);
    if (match) setSelected(match);
  }, [claims, searchParams]);
  const [paidAmount, setPaidAmount] = useState("");

  const columns = useMemo(() => {
    const grouped: Record<string, SerializedClaim[]> = {};
    for (const col of CLAIM_KANBAN_COLUMNS) {
      grouped[col.key] = [];
    }
    for (const claim of claims) {
      const key = claim.kanbanColumn;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(claim);
    }
    return CLAIM_KANBAN_COLUMNS.map((col) => ({
      ...col,
      claims: grouped[col.key] ?? [],
    }));
  }, [claims]);

  function refresh() {
    router.refresh();
  }

  function runAction(
    label: string,
    fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>,
    options?: { useSubmissionMessage?: boolean },
  ) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        const submission =
          options?.useSubmissionMessage &&
          result.data &&
          typeof result.data === "object" &&
          "submission" in result.data &&
          result.data.submission &&
          typeof result.data.submission === "object" &&
          "message" in result.data.submission &&
          typeof result.data.submission.message === "string"
            ? result.data.submission.message
            : null;
        toast.success(submission ?? label);
        setSelected(null);
        refresh();
      } else {
        toast.error(result.error ?? "Action failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Insurance Claims</h1>
          <p className="text-sm text-muted-foreground">
            Track insurer submissions, decisions, appeals, and payment reconciliation.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/billing">Back to billing</Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={claimableInvoices.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Create claim
          </Button>
        </div>
      </div>

      <div className="grid gap-4 overflow-x-auto lg:grid-cols-6">
        {columns.map((column) => (
          <div key={column.key} className="min-w-[200px] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{column.label}</h2>
              <Badge variant="secondary">{column.claims.length}</Badge>
            </div>
            <div className="space-y-2">
              {column.claims.length === 0 ? (
                <Card className="border-dashed p-4 text-center text-xs text-muted-foreground">
                  Empty
                </Card>
              ) : (
                column.claims.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} onSelect={setSelected} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create claim from invoice</DialogTitle>
          </DialogHeader>
          {claimableInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible invoices. Invoices need insurance amount &gt; 0 and an active
              primary policy, with no open claim.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {claimableInvoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction("Claim created", async () => {
                      const result = await createClaimFromInvoice({ invoiceId: inv.id });
                      if (result.success) setCreateOpen(false);
                      return result;
                    })
                  }
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      Invoice {inv.invoiceNumber}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-700">
                    {formatCurrency(inv.insuranceAmount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Claim {selected.claimNumber ?? selected.id.slice(0, 8)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge>{selected.status}</Badge>
                  {selected.policy?.providerName && (
                    <Badge variant="outline">{selected.policy.providerName}</Badge>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Patient</p>
                    <p className="font-medium">
                      {selected.patient
                        ? `${selected.patient.firstName} ${selected.patient.lastName}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Submitted amount</p>
                    <p className="font-medium">
                      {formatCurrency(selected.submittedAmount)}
                    </p>
                  </div>
                  {selected.approvedAmount != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Approved amount</p>
                      <p className="font-medium">
                        {formatCurrency(selected.approvedAmount)}
                      </p>
                    </div>
                  )}
                  {selected.paidAmount != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Paid amount</p>
                      <p className="font-medium">{formatCurrency(selected.paidAmount)}</p>
                    </div>
                  )}
                </div>

                {selected.denialReason && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                    <p className="text-xs font-semibold">Denial</p>
                    <p>{selected.denialReason}</p>
                    {selected.denialCategory && (
                      <p className="mt-1 text-xs">Category: {selected.denialCategory}</p>
                    )}
                  </div>
                )}

                {selected.paymentVariance != null && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    Payment variance: {formatCurrency(selected.paymentVariance)}
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Procedure snapshot (immutable)
                  </p>
                  <ProcedureTable lines={selected.procedureSnapshot} />
                </div>

                {selected.appealedClaim && (
                  <p className="text-xs text-muted-foreground">
                    Appeal of claim {selected.appealedClaim.claimNumber ?? selected.appealedClaim.id}
                  </p>
                )}

                {selected.status === "DRAFT" && (
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="ref">Insurer reference number</Label>
                    <Input
                      id="ref"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. CLM-2026-001234"
                    />
                    <Button
                      disabled={isPending || !referenceNumber.trim()}
                      onClick={() =>
                        runAction(
                          "Claim submitted",
                          async () => submitClaim({
                            claimId: selected.id,
                            referenceNumber: referenceNumber.trim(),
                          }),
                          { useSubmissionMessage: true },
                        )
                      }
                    >
                      Submit to insurer
                    </Button>
                  </div>
                )}

                {selected.status === "SUBMITTED" && (
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runAction("Marked in review", async () =>
                        markClaimInReview({ claimId: selected.id }),
                      )
                    }
                  >
                    Mark in review
                  </Button>
                )}

                {(selected.status === "SUBMITTED" ||
                  selected.status === "IN_REVIEW") && (
                  <div className="space-y-3 border-t pt-4">
                    <Label htmlFor="approved">Approved amount (partial)</Label>
                    <Input
                      id="approved"
                      type="number"
                      min={0}
                      step="0.01"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      placeholder={String(selected.submittedAmount)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={isPending}
                        onClick={() =>
                          runAction("Claim approved", async () =>
                            recordClaimDecision({
                              claimId: selected.id,
                              status: "APPROVED",
                              approvedAmount: approvedAmount
                                ? Number(approvedAmount)
                                : selected.submittedAmount,
                            }),
                          )
                        }
                      >
                        Approve full
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={isPending || !approvedAmount}
                        onClick={() =>
                          runAction("Partial approval recorded", async () =>
                            recordClaimDecision({
                              claimId: selected.id,
                              status: "PARTIALLY_APPROVED",
                              approvedAmount: Number(approvedAmount),
                            }),
                          )
                        }
                      >
                        Approve partial
                      </Button>
                    </div>
                    <Label htmlFor="denial">Denial reason</Label>
                    <Input
                      id="denial"
                      value={denialReason}
                      onChange={(e) => setDenialReason(e.target.value)}
                      placeholder="Reason from insurer"
                    />
                    <Button
                      variant="destructive"
                      disabled={isPending || !denialReason.trim()}
                      onClick={() =>
                        runAction("Claim denied", async () =>
                          recordClaimDecision({
                            claimId: selected.id,
                            status: "DENIED",
                            denialReason: denialReason.trim(),
                            denialCategory: "OTHER",
                          }),
                        )
                      }
                    >
                      Record denial
                    </Button>
                  </div>
                )}

                {selected.status === "DENIED" && (
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runAction("Appeal created", async () =>
                        appealClaim({ claimId: selected.id }),
                      )
                    }
                  >
                    Appeal claim
                  </Button>
                )}

                {(selected.status === "APPROVED" ||
                  selected.status === "PARTIALLY_APPROVED") && (
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="paid">Insurer paid amount</Label>
                    <Input
                      id="paid"
                      type="number"
                      min={0}
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder={String(
                        selected.approvedAmount ?? selected.submittedAmount,
                      )}
                    />
                    <Button
                      disabled={isPending || !paidAmount}
                      onClick={() =>
                        runAction("Claim marked paid", async () => {
                          const result = await markClaimPaid({
                            claimId: selected.id,
                            paidAmount: Number(paidAmount),
                          });
                          if (result.success && result.data.hasVariance) {
                            toast.warning(
                              `Payment variance: ${formatCurrency(result.data.variance)} vs approved ${formatCurrency(result.data.approvedAmount)}`,
                            );
                          }
                          return result;
                        })
                      }
                    >
                      Mark paid
                    </Button>
                    {selected.status === "PARTIALLY_APPROVED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          runAction("Claim written off", async () =>
                            writeOffClaim({
                              claimId: selected.id,
                              reason: "Uncollected balance after partial approval",
                            }),
                          )
                        }
                      >
                        Write off remainder
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                {selected.invoice && (
                  <Button variant="outline" asChild>
                    <Link href={`/billing?invoiceId=${selected.invoice.id}`}>
                      View invoice
                    </Link>
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
