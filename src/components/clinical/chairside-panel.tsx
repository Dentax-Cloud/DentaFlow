"use client";

import { useState, useCallback, useTransition, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { useProcedureSearch, type ProcedureOption } from "@/lib/clinical/use-procedure-search";
import { useVoiceDictation } from "@/lib/clinical/use-voice-dictation";
import {
  getChairsideEntryValidationIssues,
  validateChairsideSessionForFinalize,
  formatChairsideValidationError,
} from "@/lib/clinical/chairside-entry-validation";
import {
  addChairsideEntry,
  removeChairsideEntry,
  updateChairsideEntry,
  updateChairsideSessionNotes,
  finalizeChairsideSession,
  type SerializedChairsideEntry,
} from "@/app/(dashboard)/features/clinical/chairside-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const QUICK_CONDITIONS = [
  { label: "Caries", value: "CARIES", color: "bg-red-500" },
  { label: "Restoration", value: "RESTORATION", color: "bg-blue-500" },
  { label: "Crown", value: "CROWN", color: "bg-yellow-500" },
  { label: "Extraction", value: "MISSING", color: "bg-gray-500" },
  { label: "Root Canal", value: "ROOT_CANAL", color: "bg-purple-500" },
];

export type ChairsideEntryRow = {
  id: string;
  toothNumber: number | null;
  surface: string | null;
  procedureCode: string | null;
  procedureName: string | null;
  conditionType: string | null;
  notes: string | null;
  unitPrice: number;
  quantity: number;
  includeInInvoice: boolean;
};

type Props = {
  sessionId: string;
  patientName: string;
  patientAllergies?: string[];
  patientBloodGroup?: string | null;
  patientMedicalHistory?: string | null;
  appointmentId?: string;
  initialEntries: ChairsideEntryRow[];
  initialSessionNotes?: string | null;
  procedures: ProcedureOption[];
  onFinalized?: (invoiceId: string | null) => void;
  /** When false, session is view-only (e.g. nurse assisting chairside). */
  canWrite?: boolean;
};

export function ChairsidePanel({
  sessionId,
  patientName,
  patientAllergies = [],
  patientBloodGroup,
  patientMedicalHistory,
  appointmentId,
  initialEntries,
  initialSessionNotes = "",
  procedures,
  onFinalized,
  canWrite = true,
}: Props) {
  const [entries, setEntries] = useState<ChairsideEntryRow[]>(initialEntries);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [notes, setNotes] = useState(initialSessionNotes ?? "");
  const [notesSaveStatus, setNotesSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const savedNotesRef = useRef(initialSessionNotes ?? "");
  const notesSaveRequestRef = useRef(0);
  const [isPending, startTransition] = useTransition();
  const [isFinalized, setIsFinalized] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const { query, setQuery, filtered } = useProcedureSearch(procedures);

  const { isListening, isSupported, toggle: toggleDictation } = useVoiceDictation(
    useCallback((text: string) => setNotes(text), []),
  );

  useEffect(() => {
    setNotes(initialSessionNotes ?? "");
    savedNotesRef.current = initialSessionNotes ?? "";
    setNotesSaveStatus("idle");
  }, [initialSessionNotes, sessionId]);

  useEffect(() => {
    if (!canWrite) return;
    if (notes === savedNotesRef.current) {
      setNotesSaveStatus("idle");
      return;
    }

    setNotesSaveStatus("saving");
    const requestId = ++notesSaveRequestRef.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          await updateChairsideSessionNotes(sessionId, notes);
          if (requestId !== notesSaveRequestRef.current) return;
          savedNotesRef.current = notes;
          setNotesSaveStatus("saved");
        } catch {
          if (requestId !== notesSaveRequestRef.current) return;
          setNotesSaveStatus("error");
          toast.error("Could not save session notes.");
        }
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [canWrite, notes, sessionId]);

  const billableEntries = entries.filter((e) => e.includeInInvoice);
  const subtotal = billableEntries.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
  const chartValidation = useMemo(
    () => validateChairsideSessionForFinalize(entries),
    [entries],
  );
  const invalidEntryIds = useMemo(
    () => new Set(chartValidation.issues.map((issue) => issue.entryId).filter(Boolean)),
    [chartValidation.issues],
  );
  const finalizeLabel =
    billableEntries.length > 0 ? "Complete & Create Invoice" : "Complete Session";

  function mapEntry(entry: SerializedChairsideEntry): ChairsideEntryRow {
    return {
      id: entry.id,
      toothNumber: entry.toothNumber,
      surface: entry.surface,
      procedureCode: entry.procedureCode,
      procedureName: entry.procedureName,
      conditionType: entry.conditionType,
      notes: entry.notes,
      unitPrice: entry.unitPrice,
      quantity: entry.quantity,
      includeInInvoice: entry.includeInInvoice,
    };
  }

  function handleAddProcedure(proc: ProcedureOption) {
    startTransition(async () => {
      try {
        const entry = await addChairsideEntry({
          sessionId,
          toothNumber: selectedTooth ?? undefined,
          procedureCode: proc.code,
          procedureName: proc.name,
          unitPrice: proc.sellingPrice,
          quantity: 1,
          includeInInvoice: true,
          notes: notes || undefined,
        });
        setEntries((prev) => [...prev, mapEntry(entry)]);
        setQuery("");
      } catch {
        toast.error("Could not add procedure");
      }
    });
  }

  function handleAddCondition(conditionType: string) {
    if (!selectedTooth) {
      toast.error("Select a tooth number first");
      return;
    }
    startTransition(async () => {
      try {
        const entry = await addChairsideEntry({
          sessionId,
          toothNumber: selectedTooth,
          conditionType,
          notes: notes || undefined,
          includeInInvoice: false,
        });
        setEntries((prev) => [...prev, mapEntry(entry)]);
      } catch {
        toast.error("Could not record finding");
      }
    });
  }

  function handleRemoveEntry(entryId: string) {
    startTransition(async () => {
      try {
        await removeChairsideEntry(entryId);
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
      } catch {
        toast.error("Could not remove entry");
      }
    });
  }

  function handleToggleBillable(entryId: string, current: boolean) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const nextBillable = !current;
    if (nextBillable) {
      const issues = getChairsideEntryValidationIssues({
        ...entry,
        includeInInvoice: true,
      });
      if (issues.length > 0) {
        toast.error(issues[0]?.message ?? "This entry cannot be marked billable.");
        return;
      }
    }

    startTransition(async () => {
      try {
        await updateChairsideEntry(entryId, { includeInInvoice: nextBillable });
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, includeInInvoice: nextBillable } : e)),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update entry");
      }
    });
  }

  function handleFinalize() {
    if (entries.length === 0) {
      const reason = window.prompt(
        "No chart entries recorded. Enter reason no treatment was performed (required):",
      );
      if (!reason?.trim()) {
        toast.error("A reason is required when no treatment was documented.");
        return;
      }
      startTransition(async () => {
        try {
          const result = await finalizeChairsideSession(sessionId, {
            noTreatmentReason: reason.trim(),
          });
          setInvoiceId(result.invoiceId);
          setIsFinalized(true);
          onFinalized?.(result.invoiceId);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not finalize session");
        }
      });
      return;
    }

    if (!chartValidation.valid) {
      toast.error(formatChairsideValidationError(chartValidation.issues));
      return;
    }

    const confirmMessage =
      billableEntries.length > 0
        ? `Finalize session and create invoice for ${patientName}?`
        : `Finalize session for ${patientName}? No billable procedures will be invoiced.`;
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      try {
        const result = await finalizeChairsideSession(sessionId);
        setInvoiceId(result.invoiceId);
        setIsFinalized(true);
        onFinalized?.(result.invoiceId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not finalize session");
      }
    });
  }

  if (isFinalized) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 text-5xl">✅</div>
        <h2 className="mb-2 text-xl font-bold">Session Complete</h2>
        <p className="mb-6 text-muted-foreground">
          Appointment marked complete.
          {invoiceId ? " Invoice created in Billing." : " No billable items were added."}
        </p>
        {invoiceId ? (
          <Button asChild>
            <Link href="/billing">View Invoice</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/appointments">Back to appointments</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{patientName}</h2>
              <p className="text-sm text-muted-foreground">
                Chairside session {appointmentId ? "· Linked to appointment" : "· Walk-in"}
              </p>
            </div>
            <Badge variant={isPending ? "secondary" : "outline"}>
              {isPending ? "Saving entry..." : canWrite ? "Entries auto-saved" : "View only"}
            </Badge>
          </div>
          {!canWrite && (
            <p className="mt-2 text-xs text-muted-foreground">
              Read-only view — clinical chart edits require a doctor or hygienist.
            </p>
          )}
          {(patientAllergies.length > 0 || patientBloodGroup || patientMedicalHistory) && (
            <div className="mt-3 space-y-2">
              {patientAllergies.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">
                  <span className="font-semibold">Allergies: </span>
                  {patientAllergies.join(", ")}
                </div>
              )}
              {patientBloodGroup && (
                <Badge variant="destructive">Blood group: {patientBloodGroup}</Badge>
              )}
              {patientMedicalHistory && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Medical history: </span>
                  {patientMedicalHistory}
                </p>
              )}
            </div>
          )}
        </Card>

        {canWrite && (
          <>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">Selected tooth</h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={32}
              value={selectedTooth ?? ""}
              onChange={(e) => setSelectedTooth(parseInt(e.target.value, 10) || null)}
              placeholder="Tooth # (1-32)"
              className="w-32 rounded-md border px-3 py-2 text-sm"
            />
            {selectedTooth && <Badge variant="secondary">Tooth {selectedTooth} selected</Badge>}
            <Button variant="ghost" size="sm" type="button" onClick={() => setSelectedTooth(null)}>
              Clear
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">Add procedure</h3>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or name (e.g. D1110 or Cleaning)..."
            className="mb-2 w-full rounded-md border px-3 py-2 text-sm"
          />
          {query.length > 0 && (
            <div className="max-h-48 divide-y overflow-y-auto rounded-md border">
              {filtered.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No procedures found</p>
              ) : (
                filtered.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => handleAddProcedure(proc)}
                    disabled={isPending}
                    className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div>
                      <span className="mr-2 font-mono text-xs text-muted-foreground">
                        {proc.code}
                      </span>
                      <span className="text-sm font-medium">{proc.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {proc.durationMins}min
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">
                      AED {proc.sellingPrice.toFixed(2)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">
            Quick findings
            {selectedTooth && (
              <span className="ml-1 font-normal text-muted-foreground">— Tooth {selectedTooth}</span>
            )}
          </h3>
          <div className="flex flex-wrap gap-2">
            {QUICK_CONDITIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleAddCondition(c.value)}
                disabled={isPending}
                className={`rounded-full px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50 ${c.color}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {!selectedTooth && (
            <p className="mt-2 text-xs text-muted-foreground">
              Select a tooth number above to record findings
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Notes / dictation</h3>
            <div className="flex items-center gap-2">
              {canWrite && notesSaveStatus !== "idle" ? (
                <Badge
                  variant={
                    notesSaveStatus === "error"
                      ? "destructive"
                      : notesSaveStatus === "saved"
                        ? "outline"
                        : "secondary"
                  }
                  className="gap-1 font-normal"
                >
                  {notesSaveStatus === "saved" ? (
                    <>
                      <Check className="h-3 w-3" />
                      Saved
                    </>
                  ) : notesSaveStatus === "error" ? (
                    "Save failed"
                  ) : (
                    "Saving..."
                  )}
                </Badge>
              ) : null}
              {isSupported && (
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleDictation}
                >
                  {isListening ? "Stop" : "Dictate"}
                </Button>
              )}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isListening ? "Listening... speak now" : "Type notes or use voice dictation..."
            }
            rows={3}
            className={`w-full resize-none rounded-md border px-3 py-2 text-sm ${
              isListening ? "border-red-400 bg-red-50" : ""
            }`}
          />
        </Card>
          </>
        )}
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">
            Session entries
            <Badge variant="secondary" className="ml-2">
              {entries.length}
            </Badge>
          </h3>

          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No entries yet. Add procedures or findings from the left panel.
            </p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {entries.map((entry) => {
                const entryInvalid = invalidEntryIds.has(entry.id);
                return (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-2 text-sm ${
                    entryInvalid
                      ? "border-amber-300 bg-amber-50"
                      : entry.includeInInvoice
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {entry.toothNumber && (
                        <span className="mr-1 font-mono text-xs text-muted-foreground">
                          T{entry.toothNumber}
                        </span>
                      )}
                      {entry.procedureCode && (
                        <span className="mr-1 font-mono text-xs text-blue-600">
                          {entry.procedureCode}
                        </span>
                      )}
                      <span className="text-xs font-medium">
                        {entry.procedureName ?? entry.conditionType ?? "Entry"}
                      </span>
                      {entry.notes && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {entry.notes}
                        </p>
                      )}
                      {entryInvalid && (
                        <p className="mt-1 text-xs text-amber-800">
                          {getChairsideEntryValidationIssues(entry)[0]?.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {entry.unitPrice > 0 && (
                        <span className="text-xs font-semibold text-green-700">
                          AED {(entry.unitPrice * entry.quantity).toFixed(0)}
                        </span>
                      )}
                      {canWrite && (
                        <>
                      <button
                        type="button"
                        onClick={() => handleToggleBillable(entry.id, entry.includeInInvoice)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        title={entry.includeInInvoice ? "Remove from invoice" : "Add to invoice"}
                      >
                        {entry.includeInInvoice ? "Bill" : "—"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(entry.id)}
                        className="ml-1 text-xs text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </Card>

        {subtotal > 0 && (
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-medium">Invoice preview</h3>
            <div className="space-y-1 text-sm">
              {billableEntries.map((e) => (
                <div key={e.id} className="flex justify-between text-xs">
                  <span className="truncate text-muted-foreground">
                    {e.procedureName ?? e.conditionType}
                  </span>
                  <span>AED {(e.unitPrice * e.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Subtotal</span>
                <span>AED {subtotal.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        )}

        {canWrite && (
        <Button
          type="button"
          onClick={handleFinalize}
          disabled={isPending || entries.length === 0 || !chartValidation.valid}
          className="w-full"
          size="lg"
        >
          {isPending ? "Finalizing..." : finalizeLabel}
        </Button>
        )}

        {canWrite && entries.length > 0 && !chartValidation.valid && (
          <p className="text-center text-xs text-amber-800">
            Fix highlighted entries before finalizing — billable lines need a procedure and price,
            or mark findings as non-billable.
          </p>
        )}

        {canWrite && entries.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Add at least one entry to finalize
          </p>
        )}
      </div>
    </div>
  );
}
