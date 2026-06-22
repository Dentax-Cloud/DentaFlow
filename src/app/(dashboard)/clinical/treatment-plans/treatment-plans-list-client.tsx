"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { TreatmentPlan, Patient } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createTreatmentPlan } from "@/app/(dashboard)/features/clinical/actions";
import { Plus } from "lucide-react";

type PlanRow = TreatmentPlan & {
  patient: Pick<Patient, "id" | "firstName" | "lastName">;
  _count: { items: number };
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PROPOSED: "Proposed",
  ACCEPTED: "Active",
  IN_PROGRESS: "Active",
  COMPLETED: "Completed",
  DECLINED: "Rejected",
};

export function TreatmentPlansListClient({
  plans,
  patients,
}: {
  plans: PlanRow[];
  patients: { id: string; firstName: string; lastName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!patientId || !title.trim()) {
      toast.error("Patient and title required");
      return;
    }
    setSaving(true);
    const result = await createTreatmentPlan({
      patientId,
      title: title.trim(),
      notes: notes || undefined,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Treatment plan created");
      window.location.href = `/clinical/treatment-plans/${result.data.id}`;
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Treatment plans</h1>
          <p className="text-muted-foreground">Proposed care plans and cost estimates</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All plans ({plans.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plans.length === 0 && (
            <p className="text-sm text-muted-foreground">No treatment plans yet.</p>
          )}
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/clinical/treatment-plans/${plan.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{plan.title}</p>
                <p className="text-muted-foreground">
                  {plan.patient.firstName} {plan.patient.lastName} · {plan._count.items} items ·{" "}
                  {formatDate(plan.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatCurrency(Number(plan.totalCost))}</span>
                <Badge variant="outline">{STATUS_LABELS[plan.status] ?? plan.status}</Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New treatment plan</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Patient</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
