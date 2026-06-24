"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PerioChartGrid, getAllTeethMeasurements } from "./perio-chart-grid";
import { PerioStagingCard } from "./perio-staging-card";
import { calculatePerioStaging, comparePerioCharts } from "@/lib/clinical/perio-calc";
import type { PerioMeasurement } from "@/lib/clinical/types";
import { deletePerioChart } from "@/app/(dashboard)/features/clinical/perio-actions";
import { Eye, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";

export type PerioChartRecord = {
  id: string;
  chartDate: string;
  perioStage: string | null;
  perioGrade: string | null;
  bopPercent: number | null;
  notes: string | null;
  measurements: PerioMeasurement[];
};

export function PerioChartHistory({
  charts,
  onDeleted,
}: {
  charts: PerioChartRecord[];
  onDeleted?: () => void;
}) {
  const [viewChart, setViewChart] = useState<PerioChartRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function getTrend(index: number) {
    if (index >= charts.length - 1) return null;
    const current = charts[index].measurements;
    const previous = charts[index + 1].measurements;
    const { improved, deteriorated } = comparePerioCharts(previous, current);
    if (improved > deteriorated) return "improving";
    if (deteriorated > improved) return "worsening";
    return "stable";
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deletePerioChart(deleteId);
      toast.success("Perio chart deleted");
      onDeleted?.();
    } catch {
      toast.error("Could not delete chart");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  if (charts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        No periodontal charts recorded yet. Use the New Chart tab to record the first exam.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {charts.map((chart, index) => {
          const trend = getTrend(index);
          return (
            <div
              key={chart.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div>
                <p className="font-medium">{formatDate(chart.chartDate)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {chart.perioStage && (
                    <Badge variant="outline">Stage {chart.perioStage}</Badge>
                  )}
                  {chart.perioGrade && (
                    <Badge variant="outline">Grade {chart.perioGrade}</Badge>
                  )}
                  {chart.bopPercent != null && (
                    <Badge variant="secondary">BOP {chart.bopPercent}%</Badge>
                  )}
                  {trend === "improving" && (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-800">
                      <TrendingDown className="h-3 w-3" /> Improving
                    </Badge>
                  )}
                  {trend === "worsening" && (
                    <Badge className="gap-1 bg-red-100 text-red-800">
                      <TrendingUp className="h-3 w-3" /> Worsening
                    </Badge>
                  )}
                  {trend === "stable" && (
                    <Badge variant="secondary" className="gap-1">
                      <Minus className="h-3 w-3" /> Stable
                    </Badge>
                  )}
                </div>
                {chart.notes && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{chart.notes}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setViewChart(chart)}>
                  <Eye className="mr-1 h-4 w-4" />
                  View
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleteId(chart.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!viewChart} onOpenChange={(open: boolean) => !open && setViewChart(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Perio chart — {viewChart ? formatDate(viewChart.chartDate) : ""}
            </DialogTitle>
          </DialogHeader>
          {viewChart && (
            <div className="space-y-4">
              <PerioStagingCard staging={calculatePerioStaging(viewChart.measurements)} />
              <PerioChartGrid
                initialMeasurements={getAllTeethMeasurements(viewChart.measurements)}
                readOnly
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete perio chart?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the chart record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
