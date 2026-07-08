export type ChairsideEntryLike = {
  id?: string;
  procedureCode?: string | null;
  procedureName?: string | null;
  conditionType?: string | null;
  notes?: string | null;
  unitPrice?: number | string | { toString(): string } | null;
  quantity?: number | null;
  includeInInvoice: boolean;
};

export type ChairsideEntryValidationIssue = {
  entryId?: string;
  entryLabel: string;
  message: string;
};

function toUnitPrice(value: ChairsideEntryLike["unitPrice"]): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function hasProcedure(entry: ChairsideEntryLike): boolean {
  return Boolean(entry.procedureCode?.trim() || entry.procedureName?.trim());
}

function hasClinicalContent(entry: ChairsideEntryLike): boolean {
  return Boolean(
    hasProcedure(entry) ||
      entry.conditionType?.trim() ||
      entry.notes?.trim(),
  );
}

export function chairsideEntryLabel(entry: ChairsideEntryLike): string {
  return (
    entry.procedureName?.trim() ||
    entry.conditionType?.trim() ||
    entry.procedureCode?.trim() ||
    "Chart entry"
  );
}

/** Validates a single chairside entry before finalize. */
export function getChairsideEntryValidationIssues(
  entry: ChairsideEntryLike,
): ChairsideEntryValidationIssue[] {
  const label = chairsideEntryLabel(entry);
  const issues: ChairsideEntryValidationIssue[] = [];

  if (!hasClinicalContent(entry)) {
    issues.push({
      entryId: entry.id,
      entryLabel: label,
      message: "Entry has no clinical data. Add a procedure, finding, or note, or remove it.",
    });
    return issues;
  }

  if (!entry.includeInInvoice) {
    return issues;
  }

  if (!hasProcedure(entry)) {
    issues.push({
      entryId: entry.id,
      entryLabel: label,
      message:
        "Billable entries must include a procedure. Add a procedure or mark the entry non-billable.",
    });
  }

  if (toUnitPrice(entry.unitPrice) <= 0) {
    issues.push({
      entryId: entry.id,
      entryLabel: label,
      message:
        "Billable entries must have a price greater than zero. Set a price or mark non-billable.",
    });
  }

  return issues;
}

export function validateChairsideSessionForFinalize(entries: ChairsideEntryLike[]): {
  valid: boolean;
  issues: ChairsideEntryValidationIssue[];
} {
  const issues = entries.flatMap((entry) => getChairsideEntryValidationIssues(entry));
  return { valid: issues.length === 0, issues };
}

export function formatChairsideValidationError(
  issues: ChairsideEntryValidationIssue[],
): string {
  if (issues.length === 0) return "Chart entries are not valid for finalize.";
  const preview = issues
    .slice(0, 3)
    .map((issue) => `${issue.entryLabel}: ${issue.message}`)
    .join(" ");
  const suffix = issues.length > 3 ? ` (+${issues.length - 3} more)` : "";
  return `Cannot finalize — ${preview}${suffix}`;
}
