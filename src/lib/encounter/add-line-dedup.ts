/** Same catalog + teeth + surfaces within this window is treated as one Add line intent. */
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

/**
 * Accidental double-submit / re-select+add of the same catalog.
 * Declined lines and older rows are not duplicates (a later intentional add is allowed).
 */
export function findRecentDuplicateAddLine<
  T extends {
    procedureCatalogId: string;
    toothNumbers: string[];
    surfaces: string[];
    status: string;
    createdAt: Date;
  },
>(
  lines: T[],
  intent: {
    procedureCatalogId: string;
    toothNumbers?: string[] | null;
    surfaces?: string[] | null;
  },
  now = new Date(),
  windowMs = ADD_LINE_DEDUP_WINDOW_MS,
): T | undefined {
  return lines.find(
    (line) =>
      line.status !== "declined" &&
      now.getTime() - line.createdAt.getTime() <= windowMs &&
      sameAddLineIntent(line, intent),
  );
}
