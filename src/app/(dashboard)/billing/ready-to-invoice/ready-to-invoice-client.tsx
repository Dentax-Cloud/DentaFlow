"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/countries";
import { formatDate } from "@/lib/utils";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";
import {
  generateInvoiceFromProcedureLines,
  lookupPatientForBillingQueue,
  type BillingQueueEntry,
  type BillingQueueResult,
} from "@/app/(dashboard)/features/billing/ready-to-invoice-actions";

type Props = {
  queue: BillingQueueResult;
  countryCode: string;
  staffRole?: UserRole;
};

const AGING_LABELS = {
  "0-24h": "0–24 hours",
  "1-3d": "1–3 days",
  "3d+": "3+ days (review)",
} as const;

function QueueEntryCard({
  entry,
  countryCode,
  canGenerate,
  highlight,
  onGenerated,
}: {
  entry: BillingQueueEntry;
  countryCode: string;
  canGenerate: boolean;
  highlight: boolean;
  onGenerated: () => void;
}) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const money = (amount: number) => formatCurrency(amount, countryCode);

  const nextInvoiceLabel =
    entry.existingVisitInvoiceCount > 0
      ? `Invoice ${entry.existingVisitInvoiceCount + 1} of visit`
      : "Invoice 1 of visit";

  function handleGenerate() {
    startTransition(async () => {
      try {
        const lineIds = entry.unbilledClosedLines.map((line) => line.id);
        const result = await generateInvoiceFromProcedureLines(entry.appointmentId, {
          linesOnly: entry.section === "interim" ? lineIds : undefined,
        });
        toast.success(
          `${nextInvoiceLabel} created (${result.invoiceRef ?? result.invoiceId}).`,
        );
        setPreviewOpen(false);
        onGenerated();
        router.push("/billing");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not generate invoice.");
      }
    });
  }

  return (
    <>
      <Card
        id={`queue-${entry.patientId}`}
        className={highlight ? "border-dental ring-1 ring-dental/40" : undefined}
      >
        <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="space-y-1">
            <p className="font-medium">{entry.patientName}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(entry.appointmentDate)} · {entry.appointmentRef ?? entry.appointmentId}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{entry.appointmentStatus.replace("_", " ")}</Badge>
              {entry.agingBucket === "3d+" ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {AGING_LABELS[entry.agingBucket]}
                </Badge>
              ) : entry.agingBucket ? (
                <Badge variant="outline">{AGING_LABELS[entry.agingBucket]}</Badge>
              ) : null}
              {entry.existingVisitInvoiceCount > 0 ? (
                <Badge variant="outline">
                  {entry.existingVisitInvoiceCount} prior visit invoice
                  {entry.existingVisitInvoiceCount > 1 ? "s" : ""}
                </Badge>
              ) : null}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {entry.unbilledClosedLines.map((line) => (
                <li key={line.id} className="text-muted-foreground">
                  <span className="text-foreground">
                    {line.ownerType === "STORE"
                      ? "Store"
                      : (line.ownerName ?? "Doctor")}
                    {": "}
                    {line.procedureName ?? line.procedureCode ?? "Procedure"}
                  </span>
                  <span className="ml-2">
                    ×{line.quantity} · {money(line.unitPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-lg font-semibold">{money(entry.estimatedTotal)}</p>
            {canGenerate ? (
              <Button type="button" size="sm" onClick={() => setPreviewOpen(true)}>
                Generate invoice
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Billing write access required</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm invoice — {entry.patientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {nextInvoiceLabel}
              {entry.section === "interim"
                ? " (interim — visit still in progress)"
                : ""}
            </p>
            <ul className="space-y-2 rounded-md border p-3">
              {entry.unbilledClosedLines.map((line) => (
                <li key={line.id} className="flex justify-between gap-2">
                  <span>
                    {line.procedureName ?? line.procedureCode ?? "Item"} ×{line.quantity}
                  </span>
                  <span>{money(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{money(entry.estimatedTotal)}</span>
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending} onClick={handleGenerate}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate invoice"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReadyToInvoiceClient({ queue, countryCode, staffRole }: Props) {
  const router = useRouter();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [patientFilterId, setPatientFilterId] = useState<string | null>(null);
  const [isScanning, startScan] = useTransition();

  const canGenerate = Boolean(
    staffRole && hasPermission(staffRole, PERMISSIONS.billing.write),
  );

  const allReady = useMemo(
    () => [...queue.ready["0-24h"], ...queue.ready["1-3d"], ...queue.ready["3d+"]],
    [queue.ready],
  );

  const filteredReady = useMemo(() => {
    if (!patientFilterId) return allReady;
    return allReady.filter((entry) => entry.patientId === patientFilterId);
  }, [allReady, patientFilterId]);

  const filteredInterim = useMemo(() => {
    if (!patientFilterId) return queue.interim;
    return queue.interim.filter((entry) => entry.patientId === patientFilterId);
  }, [queue.interim, patientFilterId]);

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    startScan(async () => {
      try {
        const result = await lookupPatientForBillingQueue(code);
        if (!result) {
          toast.error("Patient not found for this barcode.");
          return;
        }
        setPatientFilterId(result.patientId);
        setBarcodeInput("");
        toast.success(`Showing queue for ${result.patientName}`);
        document.getElementById(`queue-${result.patientId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Barcode lookup failed.");
      }
    });
  }

  function refreshQueue() {
    router.refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ready to invoice</h1>
          <p className="text-muted-foreground">
            Aggregated billing from closed procedure lines — tax, insurance, and claims use the
            standard invoice pipeline.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/billing">All invoices</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4" />
            Barcode scan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBarcodeSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="billing-barcode">Patient barcode</Label>
              <Input
                id="billing-barcode"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan or enter patient ID…"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={isScanning}>
              {isScanning ? "Looking up…" : "Find patient"}
            </Button>
            {patientFilterId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPatientFilterId(null)}
              >
                Clear filter
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {(["0-24h", "1-3d", "3d+"] as const).map((bucket) => {
        const entries = patientFilterId
          ? queue.ready[bucket].filter((e) => e.patientId === patientFilterId)
          : queue.ready[bucket];
        if (entries.length === 0) return null;

        return (
          <section key={bucket} className="space-y-3">
            <h2 className="text-lg font-semibold">
              Completed visits — {AGING_LABELS[bucket]}
              {bucket === "3d+" ? (
                <span className="ml-2 text-sm font-normal text-destructive">
                  Revenue leakage risk
                </span>
              ) : null}
            </h2>
            <div className="space-y-3">
              {entries.map((entry) => (
                <QueueEntryCard
                  key={entry.appointmentId}
                  entry={entry}
                  countryCode={countryCode}
                  canGenerate={canGenerate}
                  highlight={patientFilterId === entry.patientId}
                  onGenerated={refreshQueue}
                />
              ))}
            </div>
          </section>
        );
      })}

      {filteredReady.length === 0 && filteredInterim.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {patientFilterId
              ? "No billable visits for this patient in the queue."
              : "No visits are ready for invoicing from procedure lines."}
          </CardContent>
        </Card>
      ) : null}

      {filteredInterim.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Partially complete — interim billing available
          </h2>
          <p className="text-sm text-muted-foreground">
            Invoice closed lines now while other procedure lines are still in progress. The visit
            stays open until all lines are closed.
          </p>
          <div className="space-y-3">
            {filteredInterim.map((entry) => (
              <QueueEntryCard
                key={entry.appointmentId}
                entry={entry}
                countryCode={countryCode}
                canGenerate={canGenerate}
                highlight={patientFilterId === entry.patientId}
                onGenerated={refreshQueue}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
