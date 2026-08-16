"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupplier, updateSupplier } from "@/app/(dashboard)/features/inventory/supplier-actions";

export type SupplierRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  itemCount: number;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

const emptyForm: FormState = { name: "", email: "", phone: "", address: "" };

export function SuppliersClient({
  suppliers: initial,
  canWrite = false,
}: {
  suppliers: SupplierRow[];
  canWrite?: boolean;
}) {
  const [suppliers, setSuppliers] = useState(initial);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialog("create");
  }

  function openEdit(row: SupplierRow) {
    setEditing(row);
    setForm({
      name: row.name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
    });
    setDialog("edit");
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      if (dialog === "create") {
        const result = await createSupplier(form);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setSuppliers((prev) =>
          [
            ...prev,
            {
              id: result.data.id,
              name: result.data.name,
              email: result.data.email,
              phone: result.data.phone,
              address: result.data.address,
              itemCount: 0,
            },
          ].sort((a, b) => a.name.localeCompare(b.name)),
        );
        toast.success("Supplier created");
      } else if (dialog === "edit" && editing) {
        const result = await updateSupplier({ id: editing.id, ...form });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setSuppliers((prev) =>
          prev
            .map((s) =>
              s.id === editing.id
                ? {
                    ...s,
                    name: result.data.name,
                    email: result.data.email,
                    phone: result.data.phone,
                    address: result.data.address,
                  }
                : s,
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        toast.success("Supplier updated");
      }
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite ? <Button onClick={openCreate}>Add supplier</Button> : null}
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No suppliers yet. Create one to link inventory items.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {suppliers.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {s.itemCount} linked item{s.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                {canWrite ? (
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                    Edit
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {s.email && <div>Email: {s.email}</div>}
                {s.phone && <div>Phone: {s.phone}</div>}
                {s.address && <div>Address: {s.address}</div>}
                {!s.email && !s.phone && !s.address && (
                  <div>No contact details</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog != null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Add supplier" : "Edit supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="supplier-name">Name</Label>
              <Input
                id="supplier-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                id="supplier-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-address">Address</Label>
              <Input
                id="supplier-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
