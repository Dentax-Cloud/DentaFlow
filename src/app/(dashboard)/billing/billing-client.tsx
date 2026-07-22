"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { formatCurrency } from "@/lib/countries";
import { invoicePayerTypeLabel } from "@/lib/billing/invoice-payer-type";
import {
  createInvoice,
  markInvoiceSent,
  recordPayment,
} from "@/app/(dashboard)/features/billing/actions";
import type { Patient, ProcedureCatalog, PaymentMethod } from "@prisma/client";
import type { Prisma } from "@prisma/client";

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: { patient: true; payments: true; items: true };
}>;

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "default",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "destructive",
  VOID: "secondary",
  REFUNDED: "destructive",
};

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  procedureCode?: string;
};

type Props = {
  invoices: InvoiceWithRelations[];
  patients: Patient[];
  procedures: ProcedureCatalog[];
  countryCode: string;
};

export function BillingClient({ invoices, patients, procedures, countryCode }: Props) {
  const router = useRouter();
  const money = (amount: number) => formatCurrency(amount, countryCode);
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithRelations | null>(null);
  const [loading, setLoading] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payReference, setPayReference] = useState("");

  const totalOutstanding = useMemo(
    () =>
      invoices
        .filter((i) => ["SENT", "PARTIAL", "OVERDUE"].includes(i.status))
        .reduce((s, i) => {
          const paid = i.payments.reduce((p, pay) => p + Number(pay.amount), 0);
          return s + Number(i.total) - paid;
        }, 0),
    [invoices],
  );

  function addLineFromProcedure(code: string) {
    const proc = procedures.find((p) => p.code === code);
    if (!proc) return;
    setItems((prev) => [
      ...prev,
      {
        description: proc.name,
        quantity: 1,
        unitPrice: Number(proc.price),
        procedureCode: proc.code,
      },
    ]);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter((i) => i.description.trim() && i.unitPrice >= 0);
    if (!patientId || validItems.length === 0) {
      toast.error("Select a patient and add at least one line item");
      return;
    }

    setLoading(true);
    const result = await createInvoice({
      patientId,
      items: validItems,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      sendNow,
    });
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`Invoice ${result.data.invoiceNumber} created`);
    setCreateOpen(false);
    setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
    router.refresh();
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setLoading(true);
    const result = await recordPayment({
      invoiceId: selectedInvoice.id,
      amount,
      method: payMethod,
      reference: payReference || undefined,
    });
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Payment recorded");
    setPayOpen(false);
    setPayAmount("");
    router.refresh();
  }

  async function handleMarkSent(invoiceId: string) {
    const result = await markInvoiceSent({ invoiceId });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice marked as sent");
    router.refresh();
  }

  function openPaymentDialog(invoice: InvoiceWithRelations) {
    const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Number(invoice.total) - paid;
    setSelectedInvoice(invoice);
    setPayAmount(balance > 0 ? balance.toFixed(2) : "");
    setPayOpen(true);
  }

  const lineTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">
            Outstanding: {money(totalOutstanding)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/billing/claims">Insurance claims</Link>
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create invoice</DialogTitle>
              <DialogDescription>Add procedure lines from your catalog or enter custom items.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {procedures.length > 0 && (
                <div className="space-y-2">
                  <Label>Add from price list</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addLineFromProcedure(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Choose procedure…</option>
                    {procedures.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {p.name} ({money(Number(p.price))})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <Label>Line items</Label>
                {items.map((item, idx) => (
                  <div key={idx} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
                    <Input
                      className="sm:col-span-3"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={1}
                      className="sm:col-span-1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="sm:col-span-2"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }])}
                >
                  Add line
                </Button>
                <p className="text-sm text-muted-foreground">Subtotal: {money(lineTotal)} (tax applied on save)</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 pt-8 text-sm">
                  <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
                  Mark as sent
                </label>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create invoice
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        {invoices.map((inv) => {
          const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
          const balance = Number(inv.total) - paid;
          return (
            <Card key={inv.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{inv.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {inv.patient.firstName} {inv.patient.lastName} · {formatDate(inv.createdAt)}
                  </p>
                  {inv.items.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {inv.items.map((i) => i.description).join(", ")}
                    </p>
                  )}
                  {balance > 0 && inv.status !== "PAID" && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      Balance due: {money(balance)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{money(Number(inv.total))}</span>
                  <Badge variant="outline">{invoicePayerTypeLabel(inv.payerType)}</Badge>
                  <Badge variant={statusColors[inv.status] ?? "secondary"}>{inv.status}</Badge>
                  {inv.status === "DRAFT" && (
                    <Button type="button" size="sm" variant="outline" onClick={() => handleMarkSent(inv.id)}>
                      Mark sent
                    </Button>
                  )}
                  {balance > 0 && inv.status !== "VOID" && (
                    <Button type="button" size="sm" onClick={() => openPaymentDialog(inv)}>
                      <Receipt className="mr-1 h-3.5 w-3.5" />
                      Record payment
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {invoices.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No invoices yet — create your first invoice above.</p>
        )}
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoiceNumber} — {selectedInvoice?.patient.firstName}{" "}
              {selectedInvoice?.patient.lastName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="STRIPE">Stripe / online</option>
                <option value="INSURANCE">Insurance</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Receipt #, txn id…" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
