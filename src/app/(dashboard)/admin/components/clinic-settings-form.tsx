"use client";

import { useState } from "react";
import type { Settings } from "@prisma/client";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateClinicSettings } from "@/app/(dashboard)/features/admin/actions";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD"] as const;

export function ClinicSettingsForm({
  settings,
  canEdit,
}: {
  settings: Settings | null;
  canEdit: boolean;
}) {
  const [currency, setCurrency] = useState(settings?.currency ?? "USD");
  const [taxRate, setTaxRate] = useState(String(settings?.taxRate ?? 0));
  const [enablePatientPortal, setEnablePatientPortal] = useState(
    settings?.enablePatientPortal ?? true,
  );
  const [enableOnlinePayments, setEnableOnlinePayments] = useState(
    settings?.enableOnlinePayments ?? true,
  );
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setLoading(true);
    const result = await updateClinicSettings({
      currency,
      taxRate: Number(taxRate),
      enablePatientPortal,
      enableOnlinePayments,
    });
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Clinic settings saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Clinic settings
        </CardTitle>
        <CardDescription>Billing defaults and patient-facing features</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                list="currency-options"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                disabled={!canEdit}
                placeholder="USD"
              />
              <datalist id="currency-options">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxRate">Tax rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="patient-portal">Patient portal</Label>
                <p className="text-sm text-muted-foreground">
                  Allow patients to view appointments and records online
                </p>
              </div>
              <Switch
                id="patient-portal"
                checked={enablePatientPortal}
                onCheckedChange={setEnablePatientPortal}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="online-payments">Online payments</Label>
                <p className="text-sm text-muted-foreground">
                  Enable card payments for invoices and subscriptions
                </p>
              </div>
              <Switch
                id="online-payments"
                checked={enableOnlinePayments}
                onCheckedChange={setEnableOnlinePayments}
                disabled={!canEdit}
              />
            </div>
          </div>

          {canEdit && (
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
