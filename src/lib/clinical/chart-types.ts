import type { ToothConditionType } from "@prisma/client";

export type ToothConditionEntry = {
  id: string;
  type: ToothConditionType;
  surfaces?: string[];
  severity?: number | null;
  notes?: string | null;
  recordedAt: string;
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
      .map((c) => c.type.replace(/_/g, " ").toLowerCase())
      .join(", ");
    lines.push(`Tooth ${tooth}: ${findings}`);
  }
  return lines.length ? lines.join("\n") : "No charted findings.";
}
