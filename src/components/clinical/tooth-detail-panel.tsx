"use client";

import { useState } from "react";
import { ToothConditionType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  CONDITION_DOT_COLORS,
  formatConditionType,
  QUICK_FINDINGS,
} from "@/lib/clinical/condition-config";
import { getDisplayNumber, type ChartNotation } from "@/lib/clinical/odontogram-notation";
import type { ToothConditionEntry } from "@/lib/clinical/chart-types";
import type { ToothSurface } from "@/lib/clinical/types";
import { CHART_SURFACES, SURFACE_LABELS } from "@/lib/clinical/types";
import { Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AddConditionInput = {
  type: ToothConditionType;
  surfaces?: ToothSurface[];
  notes?: string;
  recordedAt?: string;
};

type Props = {
  fdiNumber: string;
  notation: ChartNotation;
  conditions: ToothConditionEntry[];
  providerName?: string;
  onClose: () => void;
  onAddCondition: (input: AddConditionInput) => Promise<void>;
  onRemoveCondition: (conditionId: string) => Promise<void>;
  onMarkMissing: () => Promise<void>;
  onRestoreTooth: () => Promise<void>;
  onSuggestTreatment: () => void;
  onSurfacesChange?: (surfaces: ToothSurface[]) => void;
  treatmentLoading?: boolean;
  saving?: boolean;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ToothDetailPanel({
  fdiNumber,
  notation,
  conditions,
  providerName,
  onClose,
  onAddCondition,
  onRemoveCondition,
  onMarkMissing,
  onRestoreTooth,
  onSuggestTreatment,
  onSurfacesChange,
  treatmentLoading,
  saving,
}: Props) {
  const [notes, setNotes] = useState("");
  const [findingDate, setFindingDate] = useState(todayIsoDate());
  const [selectedSurfaces, setSelectedSurfaces] = useState<ToothSurface[]>([]);
  const [advancedType, setAdvancedType] = useState<ToothConditionType>(
    ToothConditionType.CARIES,
  );
  const display = getDisplayNumber(fdiNumber, notation);
  const isMissing = conditions.some((c) => c.type === ToothConditionType.MISSING);

  function toggleSurface(surface: ToothSurface) {
    setSelectedSurfaces((prev) => {
      const next = prev.includes(surface)
        ? prev.filter((s) => s !== surface)
        : [...prev, surface];
      onSurfacesChange?.(next);
      return next;
    });
  }

  async function quickAdd(type: ToothConditionType) {
    await onAddCondition({
      type,
      surfaces: selectedSurfaces.length > 0 ? selectedSurfaces : undefined,
      notes: notes.trim() || undefined,
      recordedAt: findingDate,
    });
    setNotes("");
    setSelectedSurfaces([]);
    onSurfacesChange?.([]);
  }

  return (
    <Card className="border-primary/20 shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Tooth {display}</CardTitle>
          <p className="text-xs text-muted-foreground">
            FDI {fdiNumber} · {conditions.length} finding
            {conditions.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {providerName && (
          <p className="text-xs text-muted-foreground">
            Recording as <span className="font-medium text-foreground">{providerName}</span>
          </p>
        )}

        <div>
          <Label className="text-xs text-muted-foreground">Surfaces (optional)</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CHART_SURFACES.map((surface) => (
              <Button
                key={surface}
                type="button"
                size="sm"
                variant={selectedSurfaces.includes(surface) ? "default" : "outline"}
                className="h-8 min-w-8 px-2"
                disabled={saving || isMissing}
                onClick={() => toggleSurface(surface)}
                title={SURFACE_LABELS[surface]}
              >
                {surface}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Leave empty to apply finding to the whole tooth
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="finding-date" className="text-xs">
              Date of finding
            </Label>
            <Input
              id="finding-date"
              type="date"
              value={findingDate}
              onChange={(e) => setFindingDate(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Quick add findings</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_FINDINGS.map(({ type, label }) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                className="gap-1.5"
                onClick={() => void quickAdd(type)}
              >
                <span className={cn("h-2 w-2 rounded-full", CONDITION_DOT_COLORS[type])} />
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tooth-notes" className="text-xs">
            Notes
          </Label>
          <Textarea
            id="tooth-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. mesial occlusal caries, watch for progression"
            disabled={saving}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Label className="text-xs">Other finding</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border px-3 text-sm"
              value={advancedType}
              onChange={(e) => setAdvancedType(e.target.value as ToothConditionType)}
            >
              {Object.values(ToothConditionType).map((c) => (
                <option key={c} value={c}>
                  {formatConditionType(c)}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            disabled={saving}
            onClick={() =>
              void onAddCondition({
                type: advancedType,
                surfaces: selectedSurfaces.length > 0 ? selectedSurfaces : undefined,
                notes: notes.trim() || undefined,
                recordedAt: findingDate,
              })
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>

        <div className="flex gap-2">
          {!isMissing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={saving}
              onClick={() => void onMarkMissing()}
            >
              Mark missing
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1"
              disabled={saving}
              onClick={() => void onRestoreTooth()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore tooth
            </Button>
          )}
        </div>

        {conditions.length > 0 && (
          <ul className="max-h-64 space-y-2 overflow-y-auto border-t pt-3">
            {conditions.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className="gap-1">
                    <span className={cn("h-2 w-2 rounded-full", CONDITION_DOT_COLORS[c.type])} />
                    {formatConditionType(c.type)}
                  </Badge>
                  {c.surfaces && c.surfaces.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Surfaces: {c.surfaces.join(", ")}
                    </p>
                  )}
                  {c.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(c.recordedAt).toLocaleString()}
                    {c.recordedByName ? ` · ${c.recordedByName}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={saving}
                  onClick={() => void onRemoveCondition(c.id)}
                  aria-label="Remove finding"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={treatmentLoading || conditions.length === 0}
          onClick={onSuggestTreatment}
        >
          {treatmentLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Suggesting treatment…
            </>
          ) : (
            "Suggest treatment from chart"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
