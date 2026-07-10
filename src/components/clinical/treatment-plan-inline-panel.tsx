"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import type { ProcedureOption } from "@/lib/clinical/use-procedure-search";
import {
  addTreatmentPlanItem,
  createTreatmentPlanRecord,
  updateTreatmentPlanItem,
} from "@/app/(dashboard)/features/clinical/treatment-plan-actions";

export type ChairsideTreatmentPlanItem = {
  id: string;
  description: string;
  status: string;
  visitNumber: number;
  linkedAppointmentId: string | null;
  procedureCode: string | null;
  procedureCatalogId: string | null;
  estimatedCost: number;
};

export type ChairsideTreatmentPlan = {
  id: string;
  title: string;
  status: string;
  items: ChairsideTreatmentPlanItem[];
};

const ACTIVE_PLAN_STATUSES = new Set(["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS"]);

function isItemOutstanding(status: string): boolean {
  return status !== "completed" && status !== "COMPLETED";
}

type Props = {
  patientId: string;
  appointmentId: string | null;
  canWrite: boolean;
  countryCode: string;
  procedures: ProcedureOption[];
  treatmentPlans: ChairsideTreatmentPlan[];
};

export function TreatmentPlanInlinePanel({
  patientId,
  appointmentId,
  canWrite,
  countryCode,
  procedures,
  treatmentPlans,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [itemVisitNum, setItemVisitNum] = useState(1);
  const [itemToothNumbers, setItemToothNumbers] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");

  const money = (amount: number) => formatCurrency(amount, countryCode);

  const activePlan = useMemo(() => {
    return treatmentPlans.find((plan) => ACTIVE_PLAN_STATUSES.has(plan.status));
  }, [treatmentPlans]);

  const outstandingItems = useMemo(() => {
    if (!activePlan) return [];
    return activePlan.items.filter((item) => isItemOutstanding(item.status));
  }, [activePlan]);

  function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planTitle.trim()) {
      toast.error("Plan title is required.");
      return;
    }
    startTransition(async () => {
      try {
        await createTreatmentPlanRecord({
          patientId,
          title: planTitle.trim(),
          notes: planNotes.trim() || undefined,
        });
        toast.success("Treatment plan created.");
        setNewPlanOpen(false);
        setPlanTitle("");
        setPlanNotes("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not create plan.");
      }
    });
  }

  function handleCatalogSelect(procId: string) {
    setSelectedCatalogId(procId);
    const proc = procedures.find((p) => p.id === procId);
    if (proc) {
      setItemDescription(proc.name);
      setItemCost(String(proc.sellingPrice));
    }
  }

  function handleAddItem() {
    if (!activePlan) return;
    if (!itemDescription.trim() || !itemCost) {
      toast.error("Description and cost are required.");
      return;
    }
    const cost = Number(itemCost);
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("Enter a valid cost.");
      return;
    }

    startTransition(async () => {
      try {
        await addTreatmentPlanItem(activePlan.id, {
          description: itemDescription.trim(),
          estimatedCost: cost,
          visitNumber: itemVisitNum,
          toothNumbers: itemToothNumbers || undefined,
          procedureCatalogId: selectedCatalogId || undefined,
          linkedAppointmentId: appointmentId,
        });
        toast.success("Item added to treatment plan.");
        setAddItemOpen(false);
        setItemDescription("");
        setItemCost("");
        setItemVisitNum(1);
        setItemToothNumbers("");
        setSelectedCatalogId("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add item.");
      }
    });
  }

  function handleMarkDoneToday(itemId: string) {
    startTransition(async () => {
      try {
        await updateTreatmentPlanItem(itemId, { status: "COMPLETED" });
        toast.success("Plan item marked complete.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update item.");
      }
    });
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Treatment plan</CardTitle>
        <p className="text-sm text-muted-foreground">
          Chart findings now or add planned work for a later visit — without leaving chairside.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {activePlan ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{activePlan.title}</p>
                <Badge variant="secondary" className="mt-1">
                  {activePlan.status}
                </Badge>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/clinical/treatment-plans/${activePlan.id}`}>Open full plan</Link>
              </Button>
            </div>

            {outstandingItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">All items on this plan are complete.</p>
            ) : (
              <ul className="space-y-2">
                {outstandingItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{item.description}</span>
                      <span className="ml-2 text-muted-foreground">
                        Visit {item.visitNumber} · {money(item.estimatedCost)}
                      </span>
                      {item.linkedAppointmentId === appointmentId && appointmentId ? (
                        <Badge variant="outline" className="ml-2 text-xs">
                          This visit
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.status}</Badge>
                      {canWrite ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleMarkDoneToday(item.id)}
                        >
                          Done today
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active treatment plan for this patient.</p>
        )}

        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setNewPlanOpen(true)}>
              Start a new plan
            </Button>
            {activePlan ? (
              <Button type="button" size="sm" onClick={() => setAddItemOpen(true)}>
                Add item to plan
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new treatment plan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div>
              <Label htmlFor="inline-plan-title">Title *</Label>
              <Input
                id="inline-plan-title"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="e.g. Full mouth rehabilitation"
                required
              />
            </div>
            <div>
              <Label htmlFor="inline-plan-notes">Notes</Label>
              <textarea
                id="inline-plan-notes"
                value={planNotes}
                onChange={(e) => setPlanNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Clinical notes for this plan..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewPlanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add item to {activePlan?.title ?? "plan"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>From catalog (optional)</Label>
              <select
                value={selectedCatalogId}
                onChange={(e) => handleCatalogSelect(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select procedure —</option>
                {procedures.map((proc) => (
                  <option key={proc.id} value={proc.id}>
                    {proc.code} — {proc.name} ({money(proc.sellingPrice)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="inline-item-desc">Description *</Label>
              <Input
                id="inline-item-desc"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inline-item-cost">Cost *</Label>
                <Input
                  id="inline-item-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemCost}
                  onChange={(e) => setItemCost(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="inline-item-visit">Visit #</Label>
                <Input
                  id="inline-item-visit"
                  type="number"
                  min={1}
                  value={itemVisitNum}
                  onChange={(e) => setItemVisitNum(parseInt(e.target.value, 10) || 1)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="inline-item-teeth">Tooth numbers</Label>
              <Input
                id="inline-item-teeth"
                value={itemToothNumbers}
                onChange={(e) => setItemToothNumbers(e.target.value)}
                placeholder="e.g. 36, 37"
              />
            </div>
            {appointmentId ? (
              <p className="text-xs text-muted-foreground">
                This item will be linked to the current appointment.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddItemOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending || !itemDescription.trim() || !itemCost}
              onClick={handleAddItem}
            >
              {isPending ? "Saving..." : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
