import { db } from "@/lib/db";

/** Platform setting key the cached AED-base FX snapshot is stored under. */
const FX_RATES_SETTING_KEY = "fx_rates_aed_base";

/** How long a cached rate snapshot is served before a live refetch is attempted. */
const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Free, keyless FX endpoint (open.er-api.com — the open tier of exchangerate-api.com).
 * Covers every currency this app has a country profile for, including the GCC currencies
 * that ECB-based providers (e.g. Frankfurter) don't publish. Rates are quoted as "units of
 * that currency per 1 AED" since AED is this app's pricing baseline.
 */
const FX_API_URL = "https://open.er-api.com/v6/latest/AED";

export type FxRatesSnapshot = {
  base: "AED";
  /** currency code (e.g. "USD") -> units of that currency per 1 AED */
  rates: Record<string, number>;
  fetchedAt: string; // ISO timestamp
};

async function fetchLiveRates(): Promise<FxRatesSnapshot | null> {
  try {
    const res = await fetch(FX_API_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) return null;
    return { base: "AED", rates: data.rates, fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.warn("[FxRates] live fetch failed", err);
    return null;
  }
}

async function readCachedSnapshot(): Promise<FxRatesSnapshot | null> {
  try {
    const record = await db.platformSetting.findUnique({
      where: { key: FX_RATES_SETTING_KEY },
      select: { value: true },
    });
    if (!record?.value) return null;
    const parsed = JSON.parse(record.value) as FxRatesSnapshot;
    if (!parsed?.rates || typeof parsed.rates !== "object" || !parsed.fetchedAt) return null;
    return parsed;
  } catch (err) {
    console.warn("[FxRates] failed to read cached rates", err);
    return null;
  }
}

async function persistSnapshot(snapshot: FxRatesSnapshot): Promise<void> {
  try {
    await db.platformSetting.upsert({
      where: { key: FX_RATES_SETTING_KEY },
      create: {
        key: FX_RATES_SETTING_KEY,
        value: JSON.stringify(snapshot),
        encrypted: false,
        category: "SUBSCRIPTION",
        description: "Cached AED-base FX rates used to auto-convert pricing for non-overridden countries",
        updatedById: null,
      },
      update: { value: JSON.stringify(snapshot), updatedAt: new Date() },
    });
  } catch (err) {
    console.warn("[FxRates] failed to persist rates", err);
  }
}

/**
 * Returns an AED-base FX rate snapshot for auto-converting non-overridden countries' pricing.
 * Serves the cached snapshot when it's under FX_CACHE_TTL_MS old; otherwise refetches live and
 * re-caches. If a live refetch fails (API down, network error, build-time with no outbound
 * access), falls back to serving the stale cached snapshot rather than failing outright — only
 * returns null when there has never been a successful fetch, in which case callers should fall
 * back to their own static fallback pricing rather than breaking.
 */
export async function getFxRates(): Promise<FxRatesSnapshot | null> {
  const cached = await readCachedSnapshot();
  const isFresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < FX_CACHE_TTL_MS;
  if (isFresh) return cached;

  const fresh = await fetchLiveRates();
  if (fresh) {
    await persistSnapshot(fresh);
    return fresh;
  }

  // Live fetch failed — serve the stale cache if we have one rather than nothing.
  return cached;
}

/** Forces a live refetch regardless of cache freshness — used by the superadmin "Refresh" button. */
export async function refreshFxRates(): Promise<FxRatesSnapshot | null> {
  const fresh = await fetchLiveRates();
  if (!fresh) return null;
  await persistSnapshot(fresh);
  return fresh;
}
