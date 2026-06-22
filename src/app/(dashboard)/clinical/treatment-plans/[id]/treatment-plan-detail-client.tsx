"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { TreatmentPlan, TreatmentItem, Patient, ProcedureCatalog } from "@prisma/client";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  addTreatmentItem,
  generateInvoiceFromTreatmentPlan,
  removeTreatmentItem,
  scheduleAppointmentFromPlan,
  updateTreatmentPlanStatus,
} from "@/app/(dashboard)/features/clinical/actions";
import { ArrowLeft, Calendar, FileText, Plus, Trash2 } from "lucide-react";

type PlanWithRelations = TreatmentPlan & {
  patient: Patient;
  items: TreatmentItem[];
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PROPOSED: "Proposed",
  ACCEPTED: "Active",
  IN_PROGRESS: "Active",
  COMPLETED: "Completed",
  DECLINED: "Rejected",
};

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "DECLINED") return "destructive" as const;
  if (["ACCEPTED", "IN_PROGRESS", "PROPOSED"].includes(status)) return "warning" as const;
  return "secondary" as const;
}

export function TreatmentPlanDetailClient({
  plan,
  procedures,
}: {
  plan: PlanWithRelations;
  procedures: ProcedureCatalog[];
}) {
  const [items, setItems] = useState(plan.items);
  const [status, setStatus] = useState(plan.status);
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedProc, setSelectedProc] = useState("");
  const [toothNumber, setToothNumber] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [busy, setBusy] = useState(false);

  const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0);

  async function changeStatus(
    next: "DRAFT" | "PROPOSED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED",
  ) {
    setBusy(true);
    const result = await updateTreatmentPlanStatus({ planId: plan.id, status: next });
    setBusy(false);
    if (result.success) {
      setStatus(next);
      toast.success(`Plan marked as ${STATUS_LABELS[next] ?? next}`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleAddItem() {
    const proc = procedures.find((p) => p.id === selectedProc);
    const desc = description.trim() || proc?.name || "";
    const cost = estimatedCost ? Number(estimatedCost) : proc ? Number(proc.price) : 0;
    if (!desc || cost <= 0) {
      toast.error("Description and cost required");
      return;
    }
    setBusy(true);
    const result = await addTreatmentItem({
      planId: plan.id,
      procedureCatalogId: selectedProc || undefined,
      toothNumber: toothNumber || undefined,
      description: desc,
      estimatedCost: cost,
    });
    setBusy(false);
    if (result.success) {
      setItems((prev) => [...prev, result.data]);
      setAddOpen(false);
      setSelectedProc("");
      setToothNumber("");
      setDescription("");
      setEstimatedCost("");
      toast.success("Item added");
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemove(itemId: string) {
    setBusy(true);
    const result = await removeTreatmentItem({ itemId, planId: plan.id });
    setBusy(false);
    if (result.success) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success("Item removed");
    } else {
      toast.error(result.error);
    }
  }

  async function handleInvoice() {
    setBusy(true);
    const result = await generateInvoiceFromTreatmentPlan({ planId: plan.id });
    setBusy(false);
    if (result.success) {
      toast.success(`Invoice ${result.data.invoiceNumber} created`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleSchedule() {
    if (!startTime || !endTime) {
      toast.error("Start and end time required");
      return;
    }
    setBusy(true);
    const result = await scheduleAppointmentFromPlan({
      planId: plan.id,
      startTime,
      endTime,
    });
    setBusy(false);
    if (result.success) {
      toast.success("Appointment scheduled");
      setScheduleOpen(false);
      if (status === "DRAFT" || status === "PROPOSED") setStatus("IN_PROGRESS");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/clinical/treatment-plans">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All treatment plans
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{plan.title}</h1>
          <p className="text-muted-foreground">
            {plan.patient.firstName} {plan.patient.lastName} · Created {formatDate(plan.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusVariant(status)}>{STATUS_LABELS[status] ?? status}</Badge>
            {plan.aiSuggested && <Badge variant="outline">AI suggested</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && (
            <Button disabled={busy} onClick={() => changeStatus("PROPOSED")}>
              Send for approval
            </Button>
          )}
          {["PROPOSED", "ACCEPTED", "IN_PROGRESS"].includes(status) && (
            <>
              <Button disabled={busy} onClick={() => changeStatus("COMPLETED")}>
                Mark completed
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => changeStatus("DECLINED")}>
                Reject
              </Button>
            </>
          )}
          <Button variant="outline" disabled={busy} onClick={() => setScheduleOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule appointment
          </Button>
          <Button variant="secondary" disabled={busy} onClick={handleInvoice}>
            <FileText className="mr-2 h-4 w-4" />
            Generate invoice
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total estimated cost</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatCurrency(totalCost)}</p>
          {plan.description && (
            <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Treatment items</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet. Add from procedure catalog.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-muted-foreground">
                  {item.toothNumbers.length > 0 && `Tooth ${item.toothNumbers.join(", ")} · `}
                  {formatCurrency(Number(item.totalCost))} · {item.status}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                disabled={busy}
                onClick={() => handleRemove(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add treatment item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Procedure (catalog)</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedProc}
                onChange={(e) => {
                  setSelectedProc(e.target.value);
                  const p = procedures.find((x) => x.id === e.target.value);
                  if (p) {
                    setDescription(p.name);
                    setEstimatedCost(String(p.price));
                  }
                }}
              >
                <option value="">Custom / manual</option>
                {procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({formatCurrency(Number(p.price))})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tooth number</Label>
              <Input value={toothNumber} onChange={(e) => setToothNumber(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Estimated cost</Label>
              <Input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddItem} disabled={busy}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSchedule} disabled={busy}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
