"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProcedureCatalog } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateInvoiceFromProcedures } from "@/app/(dashboard)/features/clinical/actions";
import { formatCurrency } from "@/lib/countries";
import { FileText, Plus, X } from "lucide-react";

type SelectedProcedure = {
  procedureId: string;
  name: string;
  price: number;
  quantity: number;
};

export function ProcedureVisitPanel({
  patientId,
  appointmentId,
  procedures,
  countryCode,
}: {
  patientId: string;
  appointmentId?: string;
  procedures: ProcedureCatalog[];
  countryCode: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedProcedure[]>([]);
  const [pickerId, setPickerId] = useState("");
  const [generating, setGenerating] = useState(false);

  function addProcedure() {
    const item = procedures.find((p) => p.id === pickerId);
    if (!item) return;
    if (selected.some((s) => s.procedureId === item.id)) {
      toast.message("Procedure already added");
      return;
    }
    setSelected((prev) => [
      ...prev,
      {
        procedureId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: 1,
      },
    ]);
    setPickerId("");
  }

  function removeProcedure(id: string) {
    setSelected((prev) => prev.filter((s) => s.procedureId !== id));
  }

  async function handleGenerateInvoice() {
    if (!appointmentId) {
      toast.error("Select an appointment from the schedule to link billing.");
      return;
    }
    if (selected.length === 0) {
      toast.error("Add at least one procedure");
      return;
    }

    setGenerating(true);
    const result = await generateInvoiceFromProcedures({
      patientId,
      appointmentId,
      procedures: selected.map((s) => ({
        procedureId: s.procedureId,
        quantity: s.quantity,
      })),
    });
    setGenerating(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Invoice created");
    router.push(`/billing?highlight=${result.data.id}`);
  }

  const total = selected.reduce((s, p) => s + p.price * p.quantity, 0);
  const money = (amount: number) => formatCurrency(amount, countryCode);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Visit procedures</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <select
            className="flex h-10 min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
            value={pickerId}
            onChange={(e) => setPickerId(e.target.value)}
          >
            <option value="">Select procedure…</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} ({money(Number(p.price))})
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={addProcedure} disabled={!pickerId}>
            <Plus className="mr-2 h-4 w-4" />
            Add procedure
          </Button>
        </div>

        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">No procedures added for this visit.</p>
        ) : (
          <ul className="space-y-2">
            {selected.map((p) => (
              <li
                key={p.procedureId}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{p.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{money(p.price)}</Badge>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeProcedure(p.procedureId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {selected.length > 0 && (
          <div className="flex items-center justify-between border-t pt-4">
            <span className="font-medium">Total: {money(total)}</span>
            <Button onClick={handleGenerateInvoice} disabled={generating}>
              <FileText className="mr-2 h-4 w-4" />
              {generating ? "Creating…" : "Generate invoice"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
