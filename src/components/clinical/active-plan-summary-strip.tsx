"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ChairsideTreatmentPlan } from "@/components/clinical/treatment-plan-inline-panel";
import type { OutstandingPlanItem } from "@/components/clinical/procedure-lines-panel";

const ACTIVE_PLAN_STATUSES = new Set(["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS"]);

type Props = {
  treatmentPlans: ChairsideTreatmentPlan[];
  outstandingPlanItems: OutstandingPlanItem[];
  onOpenPlanTab: () => void;
};

export function ActivePlanSummaryStrip({
  treatmentPlans,
  outstandingPlanItems,
  onOpenPlanTab,
}: Props) {
  const activePlan = treatmentPlans.find((plan) => ACTIVE_PLAN_STATUSES.has(plan.status));

  if (!activePlan) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <span className="text-muted-foreground">No active treatment plan for this patient.</span>
          <Button type="button" variant="outline" size="sm" onClick={onOpenPlanTab}>
            Create plan
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{activePlan.title}</span>
            <Badge variant="secondary">{activePlan.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {outstandingPlanItems.length} outstanding item
            {outstandingPlanItems.length === 1 ? "" : "s"} for this visit
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpenPlanTab}>
          Open full plan
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
