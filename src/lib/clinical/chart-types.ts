import type { ToothConditionType } from "@prisma/client";

export type ToothConditionEntry = {
  id: string;
  type: ToothConditionType;
  surfaces?: string[];
  severity?: number | null;
  notes?: string | null;
  recordedAt: string;
  recordedBy?: string | null;
  recordedByName?: string | null;
};

export type ToothChartData = Record<
  string,
  {
    conditions: ToothConditionEntry[];
  }
>;

export function chartToSummary(data: ToothChartData): string {
  const lines: string[] = [];
  for (const [tooth, entry] of Object.entries(data)) {
    if (!entry.conditions.length) continue;
    const findings = entry.conditions
      .map((c) => {
        const surfaces =
          c.surfaces && c.surfaces.length > 0 ? ` (${c.surfaces.join(",")})` : "";
        const note = c.notes ? ` — ${c.notes}` : "";
        return `${c.type.replace(/_/g, " ").toLowerCase()}${surfaces}${note}`;
      })
      .join("; ");
    lines.push(`Tooth ${tooth}: ${findings}`);
  }
  return lines.length ? lines.join("\n") : "No charted findings.";
}

export type ChartHistoryEntry = ToothConditionEntry & { toothNumber: string };

export function chartToHistory(data: ToothChartData): ChartHistoryEntry[] {
  const entries: ChartHistoryEntry[] = [];
  for (const [toothNumber, entry] of Object.entries(data)) {
    for (const condition of entry.conditions) {
      entries.push({ ...condition, toothNumber });
    }
  }
  return entries.sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
}
