"use client";

import type { TreatmentSuggestion } from "@/lib/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Props = {
  suggestion: TreatmentSuggestion | null;
  loading: boolean;
  savingTier: "basic" | "premium" | null;
  onSaveTier: (tier: "basic" | "premium") => void;
  onDismiss: () => void;
};

export function TreatmentSuggestionsPanel({
  suggestion,
  loading,
  savingTier,
  onSaveTier,
  onDismiss,
}: Props) {
  if (!loading && !suggestion) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Suggested treatment plans</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing odontogram findings…
          </p>
        )}
        {suggestion && (
          <>
            <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <TierBlock
                title="Basic plan"
                items={suggestion.basic}
                saving={savingTier === "basic"}
                onSave={() => onSaveTier("basic")}
              />
              <TierBlock
                title="Premium plan"
                items={suggestion.premium}
                saving={savingTier === "premium"}
                onSave={() => onSaveTier("premium")}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TierBlock({
  title,
  items,
  saving,
  onSave,
}: {
  title: string;
  items: TreatmentSuggestion["basic"];
  saving: boolean;
  onSave: () => void;
}) {
  const total = items.reduce((s, i) => s + i.estimatedCost, 0);
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{title}</h4>
        <Badge variant="secondary">${total.toLocaleString()}</Badge>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item, idx) => (
          <li key={idx} className="border-b pb-2 last:border-0">
            <p>{item.description}</p>
            {item.toothNumbers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Teeth: {item.toothNumbers.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" className="w-full" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save as proposed plan"}
      </Button>
    </div>
  );
}
