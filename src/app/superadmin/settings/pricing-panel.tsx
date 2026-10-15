"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getPricingTableData,
  savePricingRow,
  clearPricingRow,
  refreshPricingFxRates,
  type PricingTableRow,
  type PricingTableData,
} from "./pricing-settings-actions";

const EMPTY_DATA: PricingTableData = { rows: [], fxUpdatedAt: null, fxSource: "unavailable" };

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function RowStatusBadge({ row }: { row: PricingTableRow }) {
  if (row.isBaseline) {
    return (
      <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
        Baseline
      </span>
    );
  }
  if (row.isOverridden) {
    return (
      <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
        Custom price ✓
      </span>
    );
  }
  return (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
      Converted (auto)
    </span>
  );
}

function PricingRowEditor({
  row,
  onSaved,
}: {
  row: PricingTableRow;
  onSaved: () => void;
}) {
  const [starter, setStarter] = useState(String(row.starterMonthly));
  const [professional, setProfessional] = useState(String(row.professionalMonthly));
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  useEffect(() => {
    setStarter(String(row.starterMonthly));
    setProfessional(String(row.professionalMonthly));
  }, [row.starterMonthly, row.professionalMonthly]);

  function handleSave() {
    const starterMonthly = Number(starter);
    const professionalMonthly = Number(professional);

    startTransition(async () => {
      try {
        await savePricingRow(row.code, starterMonthly, professionalMonthly);
        setStatus({ type: "success", message: "Saved" });
        onSaved();
        setTimeout(() => setStatus(null), 2500);
      } catch (err: unknown) {
        setStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Save failed",
        });
      }
    });
  }

  function handleReset() {
    const revertTo = row.isBaseline ? "its static baseline" : "live exchange-rate conversion";
    if (!confirm(`Revert ${row.name} to ${revertTo}?`)) return;
    startTransition(async () => {
      try {
        await clearPricingRow(row.code);
        setStatus({ type: "success", message: "Reverted" });
        onSaved();
        setTimeout(() => setStatus(null), 2500);
      } catch (err: unknown) {
        setStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Reset failed",
        });
      }
    });
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-3">
        <span className="mr-1.5">{row.flag}</span>
        <span className="text-sm font-medium">{row.name}</span>
      </td>
      <td className="py-2 pr-3 text-sm text-muted-foreground">
        {row.currency}
        {row.isConverted && row.fxRate && (
          <div className="text-[10px] text-muted-foreground/70">
            1 AED ≈ {row.fxRate.toFixed(row.fxRate < 1 ? 3 : 2)}
          </div>
        )}
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          min={0}
          step="0.01"
          value={starter}
          onChange={(e) => setStarter(e.target.value)}
          className="w-24 rounded-md border bg-white px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          min={0}
          step="0.01"
          value={professional}
          onChange={(e) => setProfessional(e.target.value)}
          className="w-24 rounded-md border bg-white px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 pr-3">
        <RowStatusBadge row={row} />
      </td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            Save
          </Button>
          {row.isOverridden && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={isPending}
              className="text-red-400 hover:text-red-600"
            >
              Reset
            </Button>
          )}
          {status && (
            <span
              className={`text-xs ${status.type === "success" ? "text-green-600" : "text-red-600"}`}
            >
              {status.message}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function PricingPanel() {
  const [data, setData] = useState<PricingTableData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

  function load() {
    getPricingTableData()
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function handleRefreshRates() {
    startRefresh(async () => {
      try {
        await refreshPricingFxRates();
        setRefreshStatus("Rates refreshed");
        load();
        setTimeout(() => setRefreshStatus(null), 2500);
      } catch (err: unknown) {
        setRefreshStatus(err instanceof Error ? err.message : "Refresh failed");
      }
    });
  }

  const convertedCount = data.rows.filter((r) => r.isConverted).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Starter/Professional pricing for every country is converted live from the AED baseline
        (the AE row) using current exchange rates — a visitor&apos;s country is auto-detected
        from their IP (with a manual override on the page itself), and whatever this table shows
        for their country is what they&apos;ll see. Save a row below to pin a fixed price for
        that country instead of auto-converting it; Enterprise always stays &ldquo;Custom&rdquo;.
        {convertedCount > 0 && (
          <p className="mt-2">
            {convertedCount} {convertedCount === 1 ? "country is" : "countries are"} currently
            auto-converted from the baseline.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
        <div>
          {data.fxSource === "live" && data.fxUpdatedAt ? (
            <span>
              Exchange rates last updated{" "}
              <span className="font-medium">{formatRelativeTime(data.fxUpdatedAt)}</span>
            </span>
          ) : (
            <span className="text-orange-700">
              Exchange rate service unreachable — converted prices below are using the static
              fallback table until it&apos;s back.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefreshRates} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh rates"}
          </Button>
          {refreshStatus && <span className="text-xs text-muted-foreground">{refreshStatus}</span>}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Per-country pricing</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Country</th>
                    <th className="py-2 pr-3">Currency</th>
                    <th className="py-2 pr-3">Starter / mo</th>
                    <th className="py-2 pr-3">Professional / mo</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <PricingRowEditor key={row.code} row={row} onSaved={load} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
