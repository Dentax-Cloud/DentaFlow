"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GateStatusChip, type GateChipStatus } from "@/components/clinical/gate-status-chip";
import type { SpineBillingPreview } from "@/lib/encounter/billing-preview";
import { cn } from "@/lib/utils";

export type SpinePendingPriceRow = {
  id: string;
  kind: "procedure" | "material";
  label: string;
  amount: number;
};

function money(n: number): string {
  return n.toFixed(2);
}

export type SpineBilledInvoiceSummary = {
  invoiceNumber: string;
  total: number | string;
  status?: string;
};

export function SpineBillingDrawer({
  preview,
  pendingRows = [],
  billedInvoice = null,
  insuranceChipStatus,
  insuranceLabel = "Insurance",
  open,
  onOpenChange,
  children,
}: {
  preview: SpineBillingPreview;
  /** Client-only draft selections — not included in billable/projected totals. */
  pendingRows?: SpinePendingPriceRow[];
  /** When set, drawer shows post-close invoiced state instead of empty projected totals. */
  billedInvoice?: SpineBilledInvoiceSummary | null;
  /** Must match Gate Summary insurance chip (same canonical evaluateInsuranceGate source). */
  insuranceChipStatus: GateChipStatus;
  insuranceLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}) {
  const invoicedTotal =
    billedInvoice == null
      ? null
      : typeof billedInvoice.total === "number"
        ? money(billedInvoice.total)
        : money(Number(billedInvoice.total));

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="fixed right-3 top-1/2 z-30 inline-flex min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 xl:hidden"
          aria-label="Open running total"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex flex-col border-l border-slate-200 bg-white shadow-lg transition-transform duration-200",
          "w-80 xl:w-96",
          open ? "translate-x-0" : "translate-x-full xl:translate-x-0",
          // Desktop: always show panel width when open; when closed on xl keep visible via parent layout — use collapsed strip
          !open && "xl:translate-x-0 xl:w-14",
        )}
        aria-label="Billing preview"
      >
        <div
          className={cn(
            "flex items-center border-b border-slate-200 p-2",
            open ? "justify-between" : "justify-center",
          )}
        >
          {open && (
            <h2 className="px-2 text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
              Running total
            </h2>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            aria-label={open ? "Collapse billing drawer" : "Expand billing drawer"}
          >
            {open ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {open ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <GateStatusChip
              label={insuranceLabel}
              status={insuranceChipStatus}
              className="w-full"
            />

            <ul className="space-y-2">
              {preview.lines.length === 0 ? (
                <li className="text-sm text-slate-500">No procedure lines yet</li>
              ) : (
                preview.lines.map((line) => (
                  <li
                    key={line.id}
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-md border border-slate-100 px-2.5 py-2 text-sm",
                      !line.billable && "opacity-60",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {line.code} · {line.name}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        {line.status.replaceAll("_", " ")}
                        {line.alreadyInvoiced
                          ? " · invoiced"
                          : line.billable
                            ? ""
                            : " · not billable"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums text-slate-800">
                      {money(line.unitPrice)}
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
              {billedInvoice && invoicedTotal != null ? (
                <div
                  className="rounded-md bg-teal-50 px-2.5 py-2 text-sm text-teal-950 ring-1 ring-inset ring-teal-200"
                  data-testid="spine-invoiced-summary"
                >
                  <div className="font-medium">
                    Invoiced: {billedInvoice.invoiceNumber} · {invoicedTotal}
                  </div>
                  {billedInvoice.status ? (
                    <div className="mt-0.5 text-xs capitalize text-teal-800">
                      Status: {billedInvoice.status.replaceAll("_", " ")}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-teal-800/90">
                    Procedure lines below are already on this invoice. Remaining
                    billable / projected totals are for anything still unbilled.
                  </p>
                </div>
              ) : null}
              <Row label="Procedures" value={money(preview.proceduresSubtotal)} />
              <Row label="Materials" value={money(preview.materialsSubtotal)} />
              <Row
                label="Billable subtotal"
                value={money(preview.billableSubtotal)}
                strong
              />
              <Row label="Est. coverage" value={money(preview.estimatedCoverage)} />
              <Row label="Est. copay" value={money(preview.estimatedCopay)} />
              {billedInvoice && invoicedTotal != null ? (
                <Row
                  label="Invoiced total"
                  value={invoicedTotal}
                  strong
                  accent
                />
              ) : (
                <Row
                  label="Projected total"
                  value={money(preview.projectedTotal)}
                  strong
                  accent
                />
              )}
              <p className="text-xs text-slate-500">
                {billedInvoice
                  ? "Invoice already generated for this encounter"
                  : "Tax applied when invoice is generated"}
              </p>
              {preview.gateMessage && !billedInvoice ? (
                <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                  {preview.gateMessage}
                </p>
              ) : null}
            </div>

            {pendingRows.length > 0 ? (
              <div
                className="space-y-2 border-t border-dashed border-slate-200 pt-3"
                data-pending-prices
              >
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Pending (not yet added)
                </h3>
                <ul className="space-y-2">
                  {pendingRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/80 px-2.5 py-2 text-sm text-slate-600"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{row.label}</div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          Pending · {row.kind}
                        </div>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        {money(row.amount)}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">
                  Does not affect billable subtotal or projected total
                </p>
              </div>
            ) : null}

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Materials
              </h3>
              {children}
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 flex-col items-center gap-3 py-4 xl:flex">
            <span
              className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500"
              style={{ writingMode: "vertical-rl" }}
            >
              Running total
            </span>
          </div>
        )}
      </aside>
    </>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-slate-600", strong && "font-medium text-slate-800")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums text-slate-800",
          strong && "font-semibold",
          accent && "text-teal-800",
        )}
      >
        {value}
      </span>
    </div>
  );
}
