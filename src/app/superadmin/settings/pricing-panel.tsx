"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getPricingTableData,
  savePricingRow,
  clearPricingRow,
  type PricingTableRow,
} from "./pricing-settings-actions";

function RowStatusBadge({ row }: { row: PricingTableRow }) {
  if (row.isPlaceholder) {
    return (
      <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
        Placeholder ⚠
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
    <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
      Baseline
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
    if (!confirm(`Revert ${row.name} to the default placeholder price?`)) return;
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
      <td className="py-2 pr-3 text-sm text-muted-foreground">{row.currency}</td>
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
  const [rows, setRows] = useState<PricingTableRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    getPricingTableData()
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const placeholderCount = rows.filter((r) => r.isPlaceholder).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Sets the Starter/Professional monthly price shown on the public pricing page for each
        country, in that country&apos;s own currency. A visitor&apos;s country is auto-detected
        from their IP (with a manual override on the page itself) — whatever price is saved here
        for their country is what they&apos;ll see. Enterprise always stays &ldquo;Custom&rdquo;.
        {placeholderCount > 0 && (
          <p className="mt-2 font-medium text-orange-700">
            {placeholderCount} {placeholderCount === 1 ? "currency" : "currencies"} still showing
            a placeholder price (copied from AED) — set a real price below before relying on it.
          </p>
        )}
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
                  {rows.map((row) => (
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
