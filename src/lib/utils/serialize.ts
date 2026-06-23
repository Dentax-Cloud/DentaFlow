export function serializeDecimal<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      v && typeof v === "object" && "toNumber" in v ? Number(v) : v,
    ]),
  ) as T;
}

/** Shallow serialize plus nested relation objects/arrays (one level). */
export function serializeEntity<T extends Record<string, unknown>>(
  obj: T,
  relations?: Record<string, "object" | "array">,
): T {
  const result = serializeDecimal(obj);
  if (!relations) return result;

  for (const [key, kind] of Object.entries(relations)) {
    const val = obj[key];
    if (val == null) continue;
    if (kind === "array" && Array.isArray(val)) {
      (result as Record<string, unknown>)[key] = val.map((item) =>
        serializeDecimal(item as Record<string, unknown>),
      );
    } else if (kind === "object" && typeof val === "object" && !Array.isArray(val)) {
      (result as Record<string, unknown>)[key] = serializeDecimal(val as Record<string, unknown>);
    }
  }

  return result;
}

export function serializeMany<T extends Record<string, unknown>>(items: T[]): T[] {
  return items.map(serializeDecimal);
}
