/** Statuses that still represent the in-flight Add line intent (not a new procedure). */
export const ACTIVE_ADD_LINE_STATUSES = ["planned", "in_progress"] as const;

/** Client cooldown after a successful add; server identity check does not use a timer. */
export const ADD_LINE_DEDUP_WINDOW_MS = 10_000;

function fingerprint(parts: {
  procedureCatalogId: string;
  toothNumbers?: string[] | null;
  surfaces?: string[] | null;
}) {
  const join = (xs?: string[] | null) =>
    [...(xs ?? [])].map(String).sort().join("\0");
  return `${parts.procedureCatalogId}\n${join(parts.toothNumbers)}\n${join(parts.surfaces)}`;
}

export function sameAddLineIntent(
  a: {
    procedureCatalogId: string;
    toothNumbers?: string[] | null;
    surfaces?: string[] | null;
  },
  b: {
    procedureCatalogId: string;
    toothNumbers?: string[] | null;
    surfaces?: string[] | null;
  },
) {
  return fingerprint(a) === fingerprint(b);
}

export function isActiveAddLineStatus(status: string) {
  return (ACTIVE_ADD_LINE_STATUSES as readonly string[]).includes(status);
}

/**
 * Accidental double-submit / re-select+add of the same catalog.
 * A second add is allowed after the matching line is completed, declined, or
 * given different teeth/surfaces.
 */
export function findActiveDuplicateAddLine<
  T extends {
    procedureCatalogId: string;
    toothNumbers: string[];
    surfaces: string[];
    status: string;
  },
>(
  lines: T[],
  intent: {
    procedureCatalogId: string;
    toothNumbers?: string[] | null;
    surfaces?: string[] | null;
  },
): T | undefined {
  return lines.find(
    (line) =>
      isActiveAddLineStatus(line.status) && sameAddLineIntent(line, intent),
  );
}

/** @deprecated Use findActiveDuplicateAddLine — kept as alias for existing imports. */
export function findRecentDuplicateAddLine<
  T extends {
    procedureCatalogId: string;
    toothNumbers: string[];
    surfaces: string[];
    status: string;
    createdAt?: Date;
  },
>(
  lines: T[],
  intent: {
    procedureCatalogId: string;
    toothNumbers?: string[] | null;
    surfaces?: string[] | null;
  },
): T | undefined {
  return findActiveDuplicateAddLine(lines, intent);
}
