"use client";

import { useState } from "react";
import { ToothConditionType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  CONDITION_DOT_COLORS,
  formatConditionType,
  QUICK_FINDINGS,
} from "@/lib/clinical/condition-config";
import { getDisplayNumber, type ChartNotation } from "@/lib/clinical/odontogram-notation";
import type { ToothConditionEntry } from "@/lib/clinical/chart-types";
import { Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  fdiNumber: string;
  notation: ChartNotation;
  conditions: ToothConditionEntry[];
  onClose: () => void;
  onAddCondition: (type: ToothConditionType, notes?: string) => Promise<void>;
  onRemoveCondition: (conditionId: string) => Promise<void>;
  onSuggestTreatment: () => void;
  treatmentLoading?: boolean;
  saving?: boolean;
};

export function ToothDetailPanel({
  fdiNumber,
  notation,
  conditions,
  onClose,
  onAddCondition,
  onRemoveCondition,
  onSuggestTreatment,
  treatmentLoading,
  saving,
}: Props) {
  const [notes, setNotes] = useState("");
  const [advancedType, setAdvancedType] = useState<ToothConditionType>(
    ToothConditionType.CARIES,
  );
  const display = getDisplayNumber(fdiNumber, notation);

  async function quickAdd(type: ToothConditionType) {
    await onAddCondition(type, notes.trim() || undefined);
    setNotes("");
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
                <span
                  className={cn("h-2 w-2 rounded-full", CONDITION_DOT_COLORS[type])}
                />
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tooth-notes" className="text-xs">
            Note (optional, applied to next finding)
          </Label>
          <input
            id="tooth-notes"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. mesial occlusal"
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
            onClick={() => void onAddCondition(advancedType, notes.trim() || undefined)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>

        {conditions.length > 0 && (
          <ul className="space-y-2 border-t pt-3">
            {conditions.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div>
                  <Badge variant="outline" className="gap-1">
                    <span
                      className={cn("h-2 w-2 rounded-full", CONDITION_DOT_COLORS[c.type])}
                    />
                    {formatConditionType(c.type)}
                  </Badge>
                  {c.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(c.recordedAt).toLocaleString()}
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
