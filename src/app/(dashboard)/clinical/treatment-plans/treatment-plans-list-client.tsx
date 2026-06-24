"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_CONFIG, calculatePlanTotals, type PlanStatus } from "@/lib/clinical/treatment-plan-types";
import {
  proposeTreatmentPlan,
  acceptTreatmentPlan,
} from "@/app/(dashboard)/features/clinical/treatment-plan-actions";
import { Plus } from "lucide-react";

type PlanRow = {
  id: string;
  title: string;
  status: string;
  totalCost: number;
  totalEstimate: number;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string };
  items: {
    id: string;
    status: string;
    estimatedCost: number;
    visitNumber: number;
    priority: string;
  }[];
};

type SortKey = "date" | "status" | "patient" | "total";

const STATUS_FILTERS = [
  "ALL",
  "DRAFT",
  "PROPOSED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
] as const;

export function TreatmentPlansListClient({
  plans,
  patients,
}: {
  plans: PlanRow[];
  patients: { id: string; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [patientQuery, setPatientQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let rows = [...plans];
    if (statusFilter !== "ALL") {
      rows = rows.filter((p) => p.status === statusFilter);
    }
    if (patientQuery.trim()) {
      const q = patientQuery.toLowerCase();
      rows = rows.filter((p) =>
        `${p.patient.firstName} ${p.patient.lastName}`.toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "patient") {
        const an = `${a.patient.lastName} ${a.patient.firstName}`;
        const bn = `${b.patient.lastName} ${b.patient.firstName}`;
        return an.localeCompare(bn);
      }
      return (b.totalEstimate || b.totalCost) - (a.totalEstimate || a.totalCost);
    });
    return rows;
  }, [plans, statusFilter, patientQuery, sortBy]);

  function quickAction(planId: string, action: "propose" | "accept") {
    startTransition(async () => {
      try {
        if (action === "propose") await proposeTreatmentPlan(planId);
        else await acceptTreatmentPlan(planId);
        toast.success(action === "propose" ? "Plan proposed" : "Plan accepted");
        router.refresh();
      } catch {
        toast.error("Action failed");
      }
    });
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Treatment plans</h1>
          <p className="text-muted-foreground">Proposed care plans, visits, and cost estimates</p>
        </div>
        <Button asChild>
          <Link href="/clinical/treatment-plans/new">
            <Plus className="mr-2 h-4 w-4" />
            New plan
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>All plans ({filtered.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "ALL" ? "All" : (STATUS_CONFIG[s as PlanStatus]?.label ?? s)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search patient..."
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-10 rounded-md border px-3 text-sm"
            >
              <option value="date">Sort: date</option>
              <option value="status">Sort: status</option>
              <option value="patient">Sort: patient</option>
              <option value="total">Sort: total estimate</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No treatment plans match your filters.</p>
          )}
          {filtered.map((plan) => {
            const totals = calculatePlanTotals(plan.items);
            const hasUrgent = plan.items.some((i) => i.priority === "URGENT");
            const statusCfg = STATUS_CONFIG[plan.status as PlanStatus];

            return (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <Link
                  href={`/clinical/treatment-plans/${plan.id}`}
                  className="min-w-0 flex-1 transition-colors hover:text-primary"
                >
                  <div className="flex items-center gap-2">
                    {hasUrgent && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" title="Urgent items" />
                    )}
                    <p className="truncate font-medium">{plan.title}</p>
                  </div>
                  <p className="text-muted-foreground">
                    {plan.patient.firstName} {plan.patient.lastName} · {plan.items.length} items ·{" "}
                    {totals.visits} visits · {formatDate(plan.createdAt)}
                  </p>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {formatCurrency(plan.totalEstimate || plan.totalCost)}
                  </span>
                  <Badge className={statusCfg?.color ?? ""}>
                    {statusCfg?.label ?? plan.status}
                  </Badge>
                  {plan.status === "DRAFT" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => quickAction(plan.id, "propose")}
                    >
                      Propose
                    </Button>
                  )}
                  {plan.status === "PROPOSED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => quickAction(plan.id, "accept")}
                    >
                      Accept
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/clinical/treatment-plans/${plan.id}`}>View</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {patients.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {patients.length} patients available for new plans
        </p>
      )}
    </div>
  );
}
