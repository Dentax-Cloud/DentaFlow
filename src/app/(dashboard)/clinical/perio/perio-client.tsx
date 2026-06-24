"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PerioChartGrid, getAllTeethMeasurements } from "@/components/clinical/perio-chart-grid";
import { PerioStagingCard } from "@/components/clinical/perio-staging-card";
import {
  PerioChartHistory,
  type PerioChartRecord,
} from "@/components/clinical/perio-chart-history";
import { createPerioChart } from "@/app/(dashboard)/features/clinical/perio-actions";
import {
  calculatePerioStaging,
  comparePerioCharts,
  toothMaxDepth,
} from "@/lib/clinical/perio-calc";
import type { PerioMeasurement } from "@/lib/clinical/types";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type PatientOption = { id: string; firstName: string; lastName: string };

export function PerioPageClient({
  patients,
  selectedPatientId,
  chartHistory,
  currentStaffId,
  currentStaffName,
}: {
  patients: PatientOption[];
  selectedPatientId: string | null;
  chartHistory: PerioChartRecord[];
  currentStaffId: string | null;
  currentStaffName: string;
}) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(selectedPatientId ?? "");
  const [measurements, setMeasurements] = useState<PerioMeasurement[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastStaging, setLastStaging] = useState<ReturnType<typeof calculatePerioStaging> | null>(
    null,
  );
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  const liveStaging = useMemo(
    () => (measurements.length ? calculatePerioStaging(measurements) : null),
    [measurements],
  );

  const comparison = useMemo(() => {
    if (!compareA || !compareB || compareA === compareB) return null;
    const chartA = chartHistory.find((c) => c.id === compareA);
    const chartB = chartHistory.find((c) => c.id === compareB);
    if (!chartA || !chartB) return null;
    return {
      chartA,
      chartB,
      stats: comparePerioCharts(chartA.measurements, chartB.measurements),
      stagingA: calculatePerioStaging(chartA.measurements),
      stagingB: calculatePerioStaging(chartB.measurements),
    };
  }, [compareA, compareB, chartHistory]);

  function highlightCompare(toothNumber: number): "improved" | "deteriorated" | "stable" | null {
    if (!comparison) return null;
    const base = comparison.chartA.measurements.find((m) => m.toothNumber === toothNumber);
    const curr = comparison.chartB.measurements.find((m) => m.toothNumber === toothNumber);
    if (!base || !curr) return null;
    const baseMax = toothMaxDepth(base);
    const currMax = toothMaxDepth(curr);
    if (currMax < baseMax - 0.5) return "improved";
    if (currMax > baseMax + 0.5) return "deteriorated";
    return "stable";
  }

  function handlePatientChange(id: string) {
    setPatientId(id);
    setLastStaging(null);
    setMeasurements([]);
    router.replace(id ? `/clinical/perio?patientId=${id}` : "/clinical/perio");
  }

  async function handleSave() {
    if (!patientId) {
      toast.error("Select a patient first");
      return;
    }
    const full = measurements.length
      ? getAllTeethMeasurements(measurements)
      : getAllTeethMeasurements([]);

    setSaving(true);
    try {
      const result = await createPerioChart({
        patientId,
        measurements: full,
        notes: notes.trim() || undefined,
        examinerId: currentStaffId ?? undefined,
      });
      setLastStaging(result.staging);
      setNotes("");
      toast.success("Perio chart saved");
      router.refresh();
    } catch {
      toast.error("Failed to save chart");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Periodontal charting</h1>
          <p className="text-muted-foreground">6-point probing, auto-staging & chart comparison</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={patientId ? `/clinical?patientId=${patientId}` : "/clinical"}>
            Odontogram
          </Link>
        </Button>
      </div>

      <div className="max-w-md space-y-2">
        <Label htmlFor="perio-patient">Patient</Label>
        <select
          id="perio-patient"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={patientId}
          onChange={(e) => handlePatientChange(e.target.value)}
        >
          <option value="">Select patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      {!patientId ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a patient to record or review periodontal charts.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new">New chart</TabsTrigger>
            <TabsTrigger value="history">History ({chartHistory.length})</TabsTrigger>
            <TabsTrigger value="compare" disabled={chartHistory.length < 2}>
              Compare
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">New periodontal exam</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Examiner: {currentStaffName}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {(liveStaging || lastStaging) && (
                  <PerioStagingCard staging={(lastStaging ?? liveStaging)!} />
                )}
                <PerioChartGrid onChange={setMeasurements} />
                <div className="space-y-1">
                  <Label htmlFor="perio-notes">Clinical notes</Label>
                  <Textarea
                    id="perio-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes for this exam…"
                  />
                </div>
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save chart"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <PerioChartHistory charts={chartHistory} onDeleted={() => router.refresh()} />
          </TabsContent>

          <TabsContent value="compare" className="mt-4 space-y-4">
            {chartHistory.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Record at least two charts to compare.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Baseline chart</Label>
                    <Select value={compareA} onValueChange={setCompareA}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select older chart" />
                      </SelectTrigger>
                      <SelectContent>
                        {chartHistory.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {new Date(c.chartDate).toLocaleDateString()} — Stage{" "}
                            {c.perioStage ?? "?"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Follow-up chart</Label>
                    <Select value={compareB} onValueChange={setCompareB}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select newer chart" />
                      </SelectTrigger>
                      <SelectContent>
                        {chartHistory.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {new Date(c.chartDate).toLocaleDateString()} — Stage{" "}
                            {c.perioStage ?? "?"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {comparison && (
                  <>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="text-emerald-600">
                        {comparison.stats.improved} teeth improved
                      </span>
                      <span className="text-muted-foreground">
                        {comparison.stats.stable} stable
                      </span>
                      <span className="text-red-600">
                        {comparison.stats.deteriorated} deteriorated
                      </span>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Baseline</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <PerioStagingCard staging={comparison.stagingA} />
                          <div className="mt-4 overflow-x-auto">
                            <PerioChartGrid
                              initialMeasurements={comparison.chartA.measurements}
                              readOnly
                              highlightTooth={highlightCompare}
                            />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Follow-up</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <PerioStagingCard staging={comparison.stagingB} />
                          <div className="mt-4 overflow-x-auto">
                            <PerioChartGrid
                              initialMeasurements={comparison.chartB.measurements}
                              readOnly
                              highlightTooth={highlightCompare}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
