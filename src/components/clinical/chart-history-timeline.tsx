"use client";

import { useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  type ChartHistoryEntry,
  chartToHistory,
  type ToothChartData,
} from "@/lib/clinical/chart-types";
import {
  CONDITION_DOT_COLORS,
  formatConditionType,
} from "@/lib/clinical/condition-config";
import { getDisplayNumber, type ChartNotation } from "@/lib/clinical/odontogram-notation";
import { resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

type Props = {
  chartData: ToothChartData;
  notation: ChartNotation;
  patientName?: string;
  filterTooth?: string;
  /** Tenant.timezone — required for hydration-safe recordedAt display. */
  timezone?: string | null;
};

function inDateRange(iso: string, from?: string, to?: string) {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
}

export function ChartHistoryTimeline({
  chartData,
  notation,
  patientName,
  filterTooth,
  timezone,
}: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toothFilter, setToothFilter] = useState(filterTooth ?? "");
  const tz = resolveClinicTimezone(timezone);

  const history = useMemo(() => {
    const all = chartToHistory(chartData);
    return all.filter((entry) => {
      if (toothFilter && entry.toothNumber !== toothFilter) return false;
      return inDateRange(entry.recordedAt, dateFrom || undefined, dateTo || undefined);
    });
  }, [chartData, dateFrom, dateTo, toothFilter]);

  const groupedByTooth = useMemo(() => {
    const map = new Map<string, ChartHistoryEntry[]>();
    for (const entry of history) {
      const list = map.get(entry.toothNumber) ?? [];
      list.push(entry);
      map.set(entry.toothNumber, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [history]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Clinical history</CardTitle>
        {patientName && (
          <p className="text-sm text-muted-foreground">{patientName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="history-from" className="text-xs">
              From
            </Label>
            <Input
              id="history-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-to" className="text-xs">
              To
            </Label>
            <Input
              id="history-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-tooth" className="text-xs">
              Tooth (FDI)
            </Label>
            <Input
              id="history-tooth"
              placeholder="e.g. 36"
              value={toothFilter}
              onChange={(e) => setToothFilter(e.target.value)}
              className="h-8 w-24"
            />
          </div>
          {(dateFrom || dateTo || toothFilter) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setToothFilter(filterTooth ?? "");
              }}
            >
              <Filter className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings in this date range.</p>
        ) : (
          <div className="space-y-6">
            {groupedByTooth.map(([toothNumber, entries]) => (
              <div key={toothNumber}>
                <h4 className="mb-2 text-sm font-semibold">
                  Tooth {getDisplayNumber(toothNumber, notation)}{" "}
                  <span className="font-normal text-muted-foreground">(FDI {toothNumber})</span>
                </h4>
                <ol className="relative border-l border-border pl-4">
                  {entries.map((entry) => (
                    <li key={entry.id} className="mb-4 ml-2">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                      <div className="rounded-md border bg-muted/20 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                CONDITION_DOT_COLORS[entry.type],
                              )}
                            />
                            {formatConditionType(entry.type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatInTimeZone(
                              new Date(entry.recordedAt),
                              tz,
                              "MMM d, yyyy · h:mm a",
                            )}
                          </span>
                        </div>
                        {entry.surfaces && entry.surfaces.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Surfaces: {entry.surfaces.join(", ")}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="mt-1 text-sm">{entry.notes}</p>
                        )}
                        {entry.recordedByName && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {entry.recordedByName}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
