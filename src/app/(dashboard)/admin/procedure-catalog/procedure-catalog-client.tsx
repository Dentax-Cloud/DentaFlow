"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ProcedureCatalog } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createProcedure,
  deleteProcedure,
  updateProcedure,
} from "@/app/(dashboard)/features/admin/actions";
import { formatCurrency } from "@/lib/utils";
import { Pencil, Plus, Trash2 } from "lucide-react";

const CATEGORIES = [
  "Preventive",
  "Restorative",
  "Orthodontic",
  "Surgical",
  "Diagnostic",
  "Cosmetic",
];

type FormState = {
  id?: string;
  code: string;
  name: string;
  category: string;
  durationMins: string;
  costPrice: string;
  sellingPrice: string;
  notes: string;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  category: "Preventive",
  durationMins: "30",
  costPrice: "",
  sellingPrice: "",
  notes: "",
};

export function ProcedureCatalogClient({
  initialProcedures,
}: {
  initialProcedures: ProcedureCatalog[];
}) {
  const [procedures, setProcedures] = useState(initialProcedures);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: ProcedureCatalog) {
    setForm({
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category ?? "Preventive",
      durationMins: String(p.duration ?? 30),
      costPrice: p.costPrice ? String(p.costPrice) : "",
      sellingPrice: String(p.price),
      notes: p.description ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category,
      durationMins: Number(form.durationMins) || 30,
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      sellingPrice: Number(form.sellingPrice) || 0,
      notes: form.notes || undefined,
    };

    const result = form.id
      ? await updateProcedure({ id: form.id, ...payload })
      : await createProcedure(payload);

    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (form.id) {
      setProcedures((prev) => prev.map((p) => (p.id === form.id ? result.data : p)));
    } else {
      setProcedures((prev) => [...prev, result.data]);
    }
    toast.success(form.id ? "Procedure updated" : "Procedure created");
    setOpen(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteProcedure({ id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setProcedures((prev) => prev.filter((p) => p.id !== id));
    toast.success("Procedure removed");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Procedure catalog</h1>
          <p className="text-muted-foreground">Codes, pricing, and durations for clinical billing</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add procedure
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Procedures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Code</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Cost</th>
                  <th className="pb-2 pr-4">Price</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {procedures.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-mono">{p.code}</td>
                    <td className="py-3 pr-4">{p.name}</td>
                    <td className="py-3 pr-4">{p.category ?? "—"}</td>
                    <td className="py-3 pr-4">{p.duration ?? "—"} min</td>
                    <td className="py-3 pr-4">
                      {p.costPrice ? formatCurrency(Number(p.costPrice)) : "—"}
                    </td>
                    <td className="py-3 pr-4">{formatCurrency(Number(p.price))}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {procedures.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No procedures yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit procedure" : "Add procedure"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="D0120"
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Duration (mins)</Label>
                <Input
                  type="number"
                  value={form.durationMins}
                  onChange={(e) => setForm({ ...form, durationMins: e.target.value })}
                />
              </div>
              <div>
                <Label>Cost (AED)</Label>
                <Input
                  type="number"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                />
              </div>
              <div>
                <Label>Selling price (AED)</Label>
                <Input
                  type="number"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
