"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  proposeTreatmentPlan,
  acceptTreatmentPlan,
  declineTreatmentPlan,
  completeTreatmentPlan,
  startTreatmentPlan,
  reviseTreatmentPlan,
  addTreatmentPlanItem,
  updateTreatmentPlanItem,
  removeTreatmentPlanItem,
  scheduleVisitAppointment,
  generateInvoiceFromPlan,
  createPlanShareLink,
} from "@/app/(dashboard)/features/clinical/treatment-plan-actions";
import {
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  calculatePlanTotals,
  type PlanStatus,
  type Priority,
} from "@/lib/clinical/treatment-plan-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TreatmentPlanItemRow = {
  id: string;
  description: string;
  estimatedCost: number;
  status: string;
  visitNumber: number;
  priority: Priority;
  toothNumbers: string;
  surfaces: string | null;
  estimatedDuration: number | null;
};

export type TreatmentPlanView = {
  id: string;
  title: string;
  status: string;
  version: number;
  description: string | null;
  createdAt: string;
  patient: { firstName: string; lastName: string };
  items: TreatmentPlanItemRow[];
};

export type ProcedureRow = {
  id: string;
  code: string;
  name: string;
  price: number;
  duration: number | null;
};

export type PlanVersionRow = {
  id: string;
  version: number;
  status: string;
  createdAt: string;
  title: string;
};

function groupByVisit(items: TreatmentPlanItemRow[]) {
  return items.reduce(
    (acc, item) => {
      const visit = item.visitNumber ?? 1;
      if (!acc[visit]) acc[visit] = [];
      acc[visit].push(item);
      return acc;
    },
    {} as Record<number, TreatmentPlanItemRow[]>,
  );
}

const priorityOrder: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  ELECTIVE: 2,
  COSMETIC: 3,
};

export function TreatmentPlanClient({
  plan,
  procedures,
  versions,
}: {
  plan: TreatmentPlanView;
  procedures: ProcedureRow[];
  versions: PlanVersionRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showSchedule, setShowSchedule] = useState<number | null>(null);

  const status = plan.status as PlanStatus;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const totals = calculatePlanTotals(
    plan.items.map((i) => ({
      estimatedCost: i.estimatedCost,
      status: i.status,
      visitNumber: i.visitNumber,
    })),
  );
  const visitGroups = groupByVisit(plan.items);
  const visitNumbers = Object.keys(visitGroups)
    .map(Number)
    .sort((a, b) => a - b);

  function handleStatusChange(action: string) {
    startTransition(async () => {
      try {
        switch (action) {
          case "propose":
            await proposeTreatmentPlan(plan.id);
            toast.success("Plan sent for approval");
            break;
          case "accept":
            await acceptTreatmentPlan(plan.id);
            toast.success("Plan accepted");
            break;
          case "complete":
            await completeTreatmentPlan(plan.id);
            toast.success("Plan marked complete");
            break;
          case "start":
            await startTreatmentPlan(plan.id);
            toast.success("Treatment started");
            break;
          case "decline": {
            const reason = prompt("Reason for declining (optional):");
            await declineTreatmentPlan(plan.id, reason ?? undefined);
            toast.success("Plan declined");
            break;
          }
          case "revise": {
            const reason = prompt("Reason for revision (optional):");
            const revised = await reviseTreatmentPlan(plan.id, reason ?? undefined);
            router.push(`/clinical/treatment-plans/${revised.id}`);
            return;
          }
        }
        router.refresh();
      } catch {
        toast.error("Action failed");
      }
    });
  }

  function handleShare() {
    startTransition(async () => {
      try {
        const result = await createPlanShareLink(plan.id);
        setShareUrl(result.shareUrl);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(result.shareUrl).catch(() => null);
        }
        toast.success("Share link copied");
      } catch {
        toast.error("Could not create share link");
      }
    });
  }

  function handleGenerateInvoice(visitNumber?: number) {
    startTransition(async () => {
      try {
        await generateInvoiceFromPlan(
          plan.id,
          visitNumber ? { visitNumber } : undefined,
        );
        toast.success("Invoice created");
        router.push("/billing");
      } catch {
        toast.error("Could not generate invoice");
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/clinical/treatment-plans")}
            className="mb-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Treatment Plans
          </button>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold">{plan.title}</h1>
            {versions.length > 1 && <Badge variant="outline">v{plan.version}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.patient.firstName} {plan.patient.lastName} · Created{" "}
            {new Date(plan.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge className={config.color}>{config.label}</Badge>
          {config.nextActions
            .filter((a) => a !== "delete")
            .map((action) => (
              <Button
                key={action}
                size="sm"
                variant={
                  action === "decline" ? "destructive" : action === "accept" ? "default" : "outline"
                }
                onClick={() => handleStatusChange(action)}
                disabled={isPending}
              >
                {action === "propose" && "Send for approval"}
                {action === "accept" && "Accept plan"}
                {action === "decline" && "Decline"}
                {action === "complete" && "Mark complete"}
                {action === "start" && "Start treatment"}
                {action === "revise" && "Revise plan"}
              </Button>
            ))}
          <Button size="sm" variant="outline" onClick={handleShare} disabled={isPending}>
            Share with patient
          </Button>
        </div>
      </div>

      {shareUrl && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
          <span className="text-sm text-green-800">
            Link copied (valid 7 days):{" "}
            <span className="font-mono text-xs">{shareUrl}</span>
          </span>
          <button type="button" onClick={() => setShareUrl(null)} className="text-green-600">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total estimate</p>
          <p className="text-2xl font-bold">AED {totals.total.toFixed(0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-600">AED {totals.completed.toFixed(0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="text-2xl font-bold text-orange-600">AED {totals.pending.toFixed(0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Visits planned</p>
          <p className="text-2xl font-bold">{totals.visits}</p>
        </Card>
      </div>

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visits & Procedures</TabsTrigger>
          <TabsTrigger value="versions">History</TabsTrigger>
          {plan.description && <TabsTrigger value="notes">Notes</TabsTrigger>}
        </TabsList>

        <TabsContent value="visits" className="space-y-4">
          {["DRAFT", "ACCEPTED", "IN_PROGRESS"].includes(plan.status) && (
            <Button variant="outline" size="sm" onClick={() => setShowAddItem(!showAddItem)}>
              + Add procedure
            </Button>
          )}

          {showAddItem && (
            <AddItemForm
              planId={plan.id}
              procedures={procedures}
              visitNumbers={visitNumbers}
              onSave={() => {
                setShowAddItem(false);
                router.refresh();
              }}
              onCancel={() => setShowAddItem(false)}
            />
          )}

          {visitNumbers.map((visitNum) => {
            const items = [...visitGroups[visitNum]].sort(
              (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
            );
            const visitTotal = items.reduce((sum, i) => sum + i.estimatedCost, 0);
            const visitDuration = items.reduce(
              (sum, i) => sum + (i.estimatedDuration ?? 30),
              0,
            );

            return (
              <Card key={visitNum}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      Visit {visitNum}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        · {visitDuration} min · AED {visitTotal.toFixed(0)}
                      </span>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setShowSchedule(showSchedule === visitNum ? null : visitNum)
                        }
                      >
                        Schedule
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateInvoice(visitNum)}
                        disabled={isPending}
                      >
                        Invoice visit
                      </Button>
                    </div>
                  </div>
                  {showSchedule === visitNum && (
                    <ScheduleVisitForm
                      planId={plan.id}
                      visitNumber={visitNum}
                      duration={visitDuration}
                      onSave={() => {
                        setShowSchedule(null);
                        router.refresh();
                      }}
                      onCancel={() => setShowSchedule(null)}
                    />
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((item) => (
                    <TreatmentItemRow
                      key={item.id}
                      item={item}
                      canEdit={["DRAFT", "ACCEPTED", "IN_PROGRESS"].includes(plan.status)}
                      onUpdate={() => router.refresh()}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {visitNumbers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="mb-2 text-lg">No procedures yet</p>
              <p className="text-sm">Add procedures to start building the treatment plan</p>
            </div>
          )}

          {plan.items.length > 0 && (
            <Button
              onClick={() => handleGenerateInvoice()}
              disabled={isPending}
              className="w-full"
            >
              Generate invoice for entire plan
            </Button>
          )}
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardContent className="space-y-3 pt-4">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      v{v.version} — {v.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_CONFIG[v.status as PlanStatus]?.color ?? ""}>
                      {v.status}
                    </Badge>
                    {v.id !== plan.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/clinical/treatment-plans/${v.id}`)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {plan.description && (
          <TabsContent value="notes">
            <Card>
              <CardContent className="pt-4">
                <p className="whitespace-pre-wrap text-sm">{plan.description}</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function TreatmentItemRow({
  item,
  canEdit,
  onUpdate,
}: {
  item: TreatmentPlanItemRow;
  canEdit: boolean;
  onUpdate: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const priorityCfg = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.ELECTIVE;
  const isCompleted = item.status === "COMPLETED";

  function markComplete() {
    startTransition(async () => {
      try {
        await updateTreatmentPlanItem(item.id, { status: "COMPLETED" });
        onUpdate();
      } catch {
        toast.error("Could not update item");
      }
    });
  }

  function handleRemove() {
    if (!confirm("Remove this item?")) return;
    startTransition(async () => {
      try {
        await removeTreatmentPlanItem(item.id);
        onUpdate();
      } catch {
        toast.error("Could not remove item");
      }
    });
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${
        isCompleted ? "bg-gray-50 opacity-60" : "bg-white"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${priorityCfg.bgColor} ${priorityCfg.color}`}
        >
          {priorityCfg.label}
        </span>
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${isCompleted ? "text-muted-foreground line-through" : ""}`}
          >
            {item.description}
          </p>
          {(item.toothNumbers || item.surfaces) && (
            <p className="text-xs text-muted-foreground">
              {item.toothNumbers && `Tooth ${item.toothNumbers}`}
              {item.surfaces && ` · ${item.surfaces}`}
            </p>
          )}
        </div>
      </div>
      <div className="ml-3 flex flex-shrink-0 items-center gap-2">
        <span className="text-sm font-semibold">AED {item.estimatedCost.toFixed(0)}</span>
        {isCompleted ? (
          <Badge variant="outline" className="border-green-300 text-green-600">
            Done
          </Badge>
        ) : (
          canEdit && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={markComplete}
                disabled={isPending}
                className="border-green-300 text-green-600 hover:bg-green-50"
              >
                ✓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemove}
                disabled={isPending}
                className="text-red-400 hover:text-red-600"
              >
                ✕
              </Button>
            </>
          )
        )}
      </div>
    </div>
  );
}

function AddItemForm({
  planId,
  procedures,
  visitNumbers,
  onSave,
  onCancel,
}: {
  planId: string;
  procedures: ProcedureRow[];
  visitNumbers: number[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [visitNum, setVisitNum] = useState(visitNumbers.length > 0 ? Math.max(...visitNumbers) : 1);
  const [priority, setPriority] = useState<Priority>("ELECTIVE");
  const [toothNumbers, setToothNumbers] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleProcedureSelect(procId: string) {
    const proc = procedures.find((p) => p.id === procId);
    if (proc) {
      setDescription(proc.name);
      setCost(String(Number(proc.price).toFixed(2)));
    }
  }

  function handleSave() {
    if (!description || !cost) return;
    startTransition(async () => {
      try {
        await addTreatmentPlanItem(planId, {
          description,
          estimatedCost: parseFloat(cost),
          visitNumber: visitNum,
          priority,
          toothNumbers: toothNumbers || undefined,
        });
        onSave();
      } catch {
        toast.error("Could not add item");
      }
    });
  }

  return (
    <Card className="border-blue-200 bg-blue-50 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium">From catalog (optional)</label>
          <select
            onChange={(e) => handleProcedureSelect(e.target.value)}
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="">— Select procedure —</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} (AED {Number(p.price).toFixed(0)})
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium">Description *</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Cost (AED) *</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Visit #</label>
          <input
            type="number"
            min={1}
            value={visitNum}
            onChange={(e) => setVisitNum(parseInt(e.target.value, 10) || 1)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="ELECTIVE">Elective</option>
            <option value="COSMETIC">Cosmetic</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Tooth numbers</label>
          <input
            value={toothNumbers}
            onChange={(e) => setToothNumbers(e.target.value)}
            placeholder="e.g. 36, 37"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !description || !cost}
          >
            {isPending ? "Saving..." : "Add item"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ScheduleVisitForm({
  planId,
  visitNumber,
  duration,
  onSave,
  onCancel,
}: {
  planId: string;
  visitNumber: number;
  duration: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!date) return;
    startTransition(async () => {
      try {
        await scheduleVisitAppointment(planId, visitNumber, { date, time, duration });
        toast.success("Visit scheduled");
        onSave();
      } catch {
        toast.error("Could not schedule visit");
      }
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-medium">Schedule Visit {visitNumber}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <span className="pb-2 text-xs text-muted-foreground">{duration} min</span>
        <Button size="sm" onClick={handleSave} disabled={isPending || !date}>
          Schedule
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
