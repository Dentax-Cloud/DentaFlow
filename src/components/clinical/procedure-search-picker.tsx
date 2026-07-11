"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/countries";
import { useProcedureSearch, type ProcedureOption } from "@/lib/clinical/use-procedure-search";

type Props = {
  procedures: ProcedureOption[];
  countryCode: string;
  selectedProcedureId?: string | null;
  onSelect: (procedure: ProcedureOption | null) => void;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
};

export function ProcedureSearchPicker({
  procedures,
  countryCode,
  selectedProcedureId,
  onSelect,
  label = "Search procedure",
  placeholder = "Search by code or name (e.g. D1110 or Cleaning)...",
  allowClear = true,
}: Props) {
  const { query, setQuery, filtered } = useProcedureSearch(procedures);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => (selectedProcedureId ? procedures.find((p) => p.id === selectedProcedureId) : null),
    [procedures, selectedProcedureId],
  );

  const money = (amount: number) => formatCurrency(amount, countryCode);

  function pick(proc: ProcedureOption) {
    onSelect(proc);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span>
            <span className="font-mono text-xs text-muted-foreground">{selected.code}</span>{" "}
            {selected.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{money(selected.sellingPrice)}</span>
            {allowClear ? (
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => onSelect(null)}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && query.length > 0 ? (
        <div className="max-h-48 divide-y overflow-y-auto rounded-md border bg-background">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No procedures found</p>
          ) : (
            filtered.map((proc) => (
              <button
                key={proc.id}
                type="button"
                onClick={() => pick(proc)}
                className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted"
              >
                <div>
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{proc.code}</span>
                  <span className="text-sm font-medium">{proc.name}</span>
                </div>
                <span className="text-sm font-semibold">{money(proc.sellingPrice)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
