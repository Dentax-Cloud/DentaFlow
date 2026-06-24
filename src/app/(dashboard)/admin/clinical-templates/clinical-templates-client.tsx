"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CLINICAL_TEMPLATE_TYPES, renderTemplateContent } from "@/lib/clinical/render-template";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/clinical/render-template";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  clonePlatformTemplate,
} from "@/app/(dashboard)/features/clinical/template-actions";
import { Loader2, Plus, Copy, Pencil, Trash2 } from "lucide-react";

export type TemplateRow = {
  id: string;
  name: string;
  type: string;
  content: string;
  isDefault: boolean;
  isTenantOwned: boolean;
};

const SAMPLE_VARS = {
  patient_name: "Jane Smith",
  doctor_name: "Dr. Ahmed",
  clinic_name: "DentaFlow Clinic",
  date: new Date().toLocaleDateString(),
  chief_complaint: "tooth pain",
  pain_score: "6",
  findings: "MOD caries tooth 36",
  tooth_numbers: "36",
  conditions: "caries",
  diagnosis: "reversible pulpitis",
  procedures: "restoration",
  procedure_name: "Composite filling",
  followup_weeks: "2",
  next_appointment: "In 2 weeks",
  avoid_days: "3",
};

export function ClinicalTemplatesClient({
  initialTemplates,
  canEdit,
}: {
  initialTemplates: TemplateRow[];
  canEdit: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "SOAP",
    content: "",
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const preview = useMemo(
    () => renderTemplateContent(form.content || editing?.content || "", SAMPLE_VARS),
    [form.content, editing?.content],
  );

  function openCreate() {
    setEditing(null);
    setForm({ name: "", type: "SOAP", content: "", isDefault: false });
    setOpen(true);
  }

  function openEdit(t: TemplateRow) {
    if (!t.isTenantOwned) return;
    setEditing(t);
    setForm({
      name: t.name,
      type: t.type,
      content: t.content,
      isDefault: t.isDefault,
    });
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const result = editing
      ? await updateTemplate({ id: editing.id, ...form, type: form.type as typeof form.type })
      : await createTemplate({ ...form, type: form.type as typeof form.type });
    setSaving(false);
    if (result.success) {
      toast.success(editing ? "Template updated" : "Template created");
      setOpen(false);
      window.location.reload();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteTemplate({ id });
    if (result.success) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deactivated");
    } else {
      toast.error(result.error);
    }
  }

  async function handleClone(id: string) {
    const result = await clonePlatformTemplate({ id });
    if (result.success) {
      toast.success("Template cloned to your clinic");
      window.location.reload();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clinical templates</h1>
          <p className="text-muted-foreground">
            SOAP notes, procedure notes, post-op instructions, and more
          </p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLINICAL_TEMPLATE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Content</Label>
                  <Textarea
                    rows={12}
                    className="font-mono text-sm"
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    placeholder="Use {{patient_name}}, {{findings}}, etc."
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Placeholders: {TEMPLATE_PLACEHOLDERS.join(", ")}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  />
                  Set as default for this type
                </label>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
                  <pre className="whitespace-pre-wrap text-xs">{preview}</pre>
                </div>
                <Button onClick={() => void handleSave()} disabled={saving || !form.name || !form.content}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No templates yet. Create one or clone a platform default.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{t.type.replace(/_/g, " ")}</Badge>
                      {t.isDefault && <Badge>Default</Badge>}
                      {!t.isTenantOwned && <Badge variant="secondary">Platform</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!t.isTenantOwned && canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleClone(t.id)}
                        title="Clone to clinic"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {t.isTenantOwned && canEdit && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(t.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="line-clamp-6 whitespace-pre-wrap text-xs text-muted-foreground">
                  {t.content}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
