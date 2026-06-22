"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecallSettings } from "@/lib/recall/helpers";
import { saveRecallSettings } from "@/app/(dashboard)/features/admin/actions";
import { Bell } from "lucide-react";

export function RecallSettingsSection({
  settings,
  canEdit,
}: {
  settings: RecallSettings;
  canEdit: boolean;
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(settings), [settings]);

  async function handleSave() {
    setSaving(true);
    const result = await saveRecallSettings(form);
    setSaving(false);
    if (result.success) toast.success("Recall settings saved");
    else toast.error(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Recall settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Default recall interval (months)</Label>
          <select
            className="mt-1 flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
            value={form.defaultIntervalMonths}
            disabled={!canEdit}
            onChange={(e) =>
              setForm({ ...form, defaultIntervalMonths: Number(e.target.value) })
            }
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-recall"
            checked={form.autoCreateOnComplete}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, autoCreateOnComplete: e.target.checked })}
          />
          <Label htmlFor="auto-recall">Auto-create recall after appointment completed</Label>
        </div>
        <div>
          <Label>Reminder lead time (days before due)</Label>
          <Input
            type="number"
            className="max-w-xs"
            value={form.reminderLeadDays}
            disabled={!canEdit}
            onChange={(e) =>
              setForm({ ...form, reminderLeadDays: Number(e.target.value) || 7 })
            }
          />
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save recall settings"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
