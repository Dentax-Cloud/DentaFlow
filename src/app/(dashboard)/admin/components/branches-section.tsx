"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Branch } from "@prisma/client";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus } from "lucide-react";
import {
  createBranch,
  deactivateBranch,
  updateBranch,
} from "@/app/(dashboard)/features/admin/branch-actions";

type BranchRow = Branch & {
  _count: { chairs: number; appointments: number };
  staffCount: number;
};

export function BranchesSection({
  branches: initialBranches,
  canEdit,
}: {
  branches: BranchRow[];
  canEdit: boolean;
}) {
  const [branches, setBranches] = useState(initialBranches);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditId(null);
    setName("");
    setAddress("");
    setPhone("");
    setOpen(true);
  }

  function openEdit(b: BranchRow) {
    setEditId(b.id);
    setName(b.name);
    setAddress(b.address ?? "");
    setPhone(b.phone ?? "");
    setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Branch name required");
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), address: address || undefined, phone: phone || undefined };
    const result = editId
      ? await updateBranch({ id: editId, ...payload })
      : await createBranch(payload);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (editId) {
      setBranches((prev) => prev.map((b) => (b.id === editId ? { ...b, ...result.data } : b)));
    } else {
      setBranches((prev) => [
        ...prev,
        { ...result.data, _count: { chairs: 0, appointments: 0 }, staffCount: 0 },
      ]);
    }
    toast.success(editId ? "Branch updated" : "Branch created");
    setOpen(false);
  }

  async function handleDeactivate(id: string) {
    const result = await deactivateBranch({ id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setBranches((prev) => prev.filter((b) => b.id !== id));
    toast.success("Branch deactivated");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Branches ({branches.length})
        </CardTitle>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add branch
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {branches.length === 0 && (
          <p className="text-sm text-muted-foreground">No branches configured.</p>
        )}
        {branches.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {b.name}
                {b.isPrimary && (
                  <Badge className="ml-2" variant="secondary">
                    Primary
                  </Badge>
                )}
              </p>
              <p className="text-muted-foreground">
                {b.address ?? "No address"} · {b._count.chairs} chairs ·{" "}
                {b._count.appointments} appointments
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                  Edit
                </Button>
                {!b.isPrimary && (
                  <Button size="sm" variant="ghost" onClick={() => handleDeactivate(b.id)}>
                    Deactivate
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit branch" : "Add branch"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
