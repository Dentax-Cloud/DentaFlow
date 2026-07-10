"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/countries";
import type { ProcedureOption } from "@/lib/clinical/use-procedure-search";
import type { ProcedureLineRow } from "@/app/(dashboard)/features/procedure-lines/actions";
import {
  closeProcedureLine,
  createProcedureLine,
} from "@/app/(dashboard)/features/procedure-lines/actions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  IN_PROGRESS: "default",
  CLOSED: "success",
  VOIDED: "destructive",
  LOCKED: "secondary",
};

type Props = {
  appointmentId: string;
  countryCode: string;
  currentStaffMemberId: string | null;
  canWrite: boolean;
  initialLines: ProcedureLineRow[];
  procedures: ProcedureOption[];
};

export function ProcedureLinesPanel({
  appointmentId,
  countryCode,
  currentStaffMemberId,
  canWrite,
  initialLines,
  procedures,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [procedureCode, setProcedureCode] = useState(procedures[0]?.code ?? "");
  const [unitPrice, setUnitPrice] = useState(String(procedures[0]?.sellingPrice ?? 0));
  const [quantity, setQuantity] = useState("1");

  const money = (amount: number) => formatCurrency(amount, countryCode);

  const grouped = useMemo(() => {
    const map = new Map<string, ProcedureLineRow[]>();
    for (const line of initialLines) {
      const key = `${line.ownerType}:${line.ownerId ?? "unassigned"}`;
      const bucket = map.get(key) ?? [];
      bucket.push(line);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [initialLines]);

  function handleAddMyProcedure() {
    if (!currentStaffMemberId) {
      toast.error("Your staff profile is required to add a procedure line.");
      return;
    }
    const proc = procedures.find((p) => p.code === procedureCode);
    const price = Number(unitPrice);
    const qty = Number(quantity);
    if (!proc || !Number.isFinite(price) || price < 0 || !Number.isInteger(qty) || qty < 1) {
      toast.error("Select a procedure and enter a valid price and quantity.");
      return;
    }

    startTransition(async () => {
      try {
        await createProcedureLine({
          appointmentId,
          ownerType: "DOCTOR",
          ownerId: currentStaffMemberId,
          procedureCode: proc.code,
          procedureName: proc.name,
          unitPrice: price,
          quantity: qty,
        });
        toast.success("Procedure line added.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add procedure line.");
      }
    });
  }

  function handleCloseMine(lineId: string) {
    startTransition(async () => {
      try {
        const result = await closeProcedureLine(lineId);
        toast.success(
          result.completionApplied
            ? "Your portion closed — appointment marked completed."
            : "Your portion closed.",
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not close procedure line.");
      }
    });
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Procedures (encounter lines)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Parallel charge-capture for this visit. Charting and finalize remain unchanged below.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {initialLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No procedure lines yet for this appointment.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([groupKey, groupLines]) => {
              const sample = groupLines[0];
              const label =
                sample.ownerType === "STORE"
                  ? "Store"
                  : (sample.ownerName ?? "Unassigned provider");
              return (
                <div key={groupKey} className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">{label}</p>
                  <ul className="space-y-2">
                    {groupLines.map((line) => {
                      const isMine =
                        Boolean(currentStaffMemberId) && line.ownerId === currentStaffMemberId;
                      const canClose =
                        canWrite && isMine && line.status === "IN_PROGRESS" && !isPending;
                      return (
                        <li
                          key={line.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/40 px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {line.procedureName ?? line.procedureCode ?? "Procedure"}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              ×{line.quantity} · {money(line.unitPrice * line.quantity)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={STATUS_VARIANT[line.status] ?? "secondary"}>
                              {line.status}
                            </Badge>
                            {canClose ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleCloseMine(line.id)}
                              >
                                Close my portion
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {canWrite ? (
          <div className="rounded-md border border-dashed p-3">
            <p className="mb-3 text-sm font-medium">Add my procedure</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label htmlFor="procedure-line-code">Procedure</Label>
                <select
                  id="procedure-line-code"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={procedureCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setProcedureCode(code);
                    const proc = procedures.find((p) => p.code === code);
                    if (proc) setUnitPrice(String(proc.sellingPrice));
                  }}
                >
                  {procedures.map((proc) => (
                    <option key={proc.id} value={proc.code}>
                      {proc.code} — {proc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="procedure-line-price">Unit price</Label>
                <Input
                  id="procedure-line-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="procedure-line-qty">Qty</Label>
                <Input
                  id="procedure-line-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              className="mt-3"
              size="sm"
              disabled={isPending || !currentStaffMemberId}
              onClick={handleAddMyProcedure}
            >
              Add my procedure
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
