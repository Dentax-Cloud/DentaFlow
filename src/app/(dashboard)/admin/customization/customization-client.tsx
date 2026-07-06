"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  addCustomInsuranceProvider,
  addPaymentMethod,
  addReferralContact,
  createCorporateAccount,
  createCustomField,
  createMembershipPlan,
  deleteCustomField,
  deleteCustomInsuranceProvider,
  overridePlatformInsuranceProvider,
  updateInsuranceProvider,
} from "@/app/(dashboard)/features/admin/customization-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClaimSubmissionMethod } from "@prisma/client";
import { deriveInsuranceProviderCode } from "@/lib/insurance/provider-code";

type Tab = "insurance" | "fields" | "payments" | "memberships" | "corporate" | "referrals";

type NetworkTypeRow = {
  code: string;
  name: string;
  defaultCoPayPercent: number;
};

type CustomProvider = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  shortName: string;
  isActive: boolean;
  requiresPreAuth: boolean;
  claimSubmissionMethod: ClaimSubmissionMethod;
  claimEmail: string | null;
  claimsPortalUrl: string | null;
  turnaroundDays: number | null;
  contactPhone: string | null;
  notes: string | null;
  networkTypes: NetworkTypeRow[];
};

type PlatformProvider = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  requiresPreAuth: boolean;
  claimSubmissionMethod?: ClaimSubmissionMethod;
  claimEmail?: string | null;
  claimsPortalUrl?: string | null;
  turnaroundDays?: number | null;
  networkTypes: NetworkTypeRow[];
  hasTenantOverride?: boolean;
};

const SUBMISSION_METHODS: Array<{ value: ClaimSubmissionMethod; label: string }> = [
  { value: "EMAIL", label: "Email" },
  { value: "PORTAL", label: "Portal" },
  { value: "CLEARINGHOUSE", label: "Clearinghouse" },
  { value: "MANUAL", label: "Manual" },
];

function emptyNetworkRow(): NetworkTypeRow {
  return { code: "", name: "", defaultCoPayPercent: 20 };
}

function providerToForm(provider?: CustomProvider) {
  return {
    name: provider?.name ?? "",
    nameAr: provider?.nameAr ?? "",
    shortName: provider?.shortName ?? "",
    requiresPreAuth: provider?.requiresPreAuth ?? true,
    claimSubmissionMethod: provider?.claimSubmissionMethod ?? "MANUAL",
    claimEmail: provider?.claimEmail ?? "",
    claimsPortalUrl: provider?.claimsPortalUrl ?? "",
    turnaroundDays: provider?.turnaroundDays?.toString() ?? "",
    contactPhone: provider?.contactPhone ?? "",
    notes: provider?.notes ?? "",
    networkTypes:
      provider?.networkTypes.length ? [...provider.networkTypes] : [emptyNetworkRow()],
  };
}

type Props = {
  tenant: {
    countryCode: string | null;
    currency: string;
    taxName: string;
    taxRate: number;
    regulatoryBody: string | null;
    name: string;
  } | null;
  countryProfile: {
    flag: string;
    name: string;
  };
  customFields: Array<{
    id: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
    isRequired: boolean;
    section: string;
  }>;
  platformProviders: PlatformProvider[];
  customProviders: CustomProvider[];
  membershipPlans: Array<{
    id: string;
    name: string;
    price: number;
    discountPercent: number;
    duration: string;
    _count?: { members: number };
  }>;
  corporateAccounts: Array<{
    id: string;
    companyName: string;
    discountPercent: number;
    _count?: { patients: number };
  }>;
  paymentMethods: Array<{ id: string; name: string; type: string; isDefault: boolean }>;
  referralContacts: Array<{
    id: string;
    type: string;
    name: string;
    specialty: string | null;
    phone: string | null;
  }>;
  procedures: Array<{ code: string; name: string }>;
};

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "insurance", label: "Insurance", icon: "🏥" },
  { id: "fields", label: "Patient Fields", icon: "👤" },
  { id: "payments", label: "Payment Methods", icon: "💳" },
  { id: "memberships", label: "Membership Plans", icon: "🎫" },
  { id: "corporate", label: "Corporate Accounts", icon: "🏢" },
  { id: "referrals", label: "Referral Network", icon: "🔗" },
];

function InsuranceProviderDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: CustomProvider;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [shortCodeTouched, setShortCodeTouched] = useState(false);
  const [form, setForm] = useState(providerToForm(provider));

  useEffect(() => {
    if (open) {
      setForm(providerToForm(provider));
      setShortCodeTouched(Boolean(provider?.shortName));
    }
  }, [open, provider]);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !shortCodeTouched) {
        next.shortName = deriveInsuranceProviderCode(String(value));
      }
      return next;
    });
  }

  function updateNetwork(index: number, patch: Partial<NetworkTypeRow>) {
    setForm((prev) => ({
      ...prev,
      networkTypes: prev.networkTypes.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function addNetworkRow() {
    setForm((prev) => ({
      ...prev,
      networkTypes: [...prev.networkTypes, emptyNetworkRow()],
    }));
  }

  function removeNetworkRow(index: number) {
    setForm((prev) => ({
      ...prev,
      networkTypes:
        prev.networkTypes.length <= 1
          ? prev.networkTypes
          : prev.networkTypes.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Provider name is required");
      return;
    }
    if (!form.shortName.trim()) {
      toast.error("Short code is required");
      return;
    }

    const networkTypes = form.networkTypes
      .map((n) => ({
        code: n.code.trim(),
        name: n.name.trim(),
        defaultCoPayPercent: Number(n.defaultCoPayPercent) || 0,
      }))
      .filter((n) => n.code && n.name);

    if (networkTypes.length === 0) {
      toast.error("Add at least one network type with code and name");
      return;
    }

    if (form.claimSubmissionMethod === "PORTAL" && !form.claimsPortalUrl.trim()) {
      toast.error("Portal URL is required when submission method is Portal");
      return;
    }

    const payload = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || undefined,
      shortName: form.shortName.trim(),
      requiresPreAuth: form.requiresPreAuth,
      claimSubmissionMethod: form.claimSubmissionMethod,
      claimEmail: form.claimEmail.trim() || undefined,
      claimsPortalUrl: form.claimsPortalUrl.trim() || undefined,
      turnaroundDays: form.turnaroundDays
        ? Number.parseInt(form.turnaroundDays, 10)
        : undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      notes: form.notes.trim() || undefined,
      networkTypes,
    };

    startTransition(async () => {
      try {
        if (provider) {
          await updateInsuranceProvider(provider.id, payload);
          toast.success("Provider updated");
        } else {
          await addCustomInsuranceProvider(payload);
          toast.success("Provider added");
        }
        onOpenChange(false);
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save provider");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {provider ? "Edit Insurance Provider" : "Add Insurance Provider"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="provider-name">Provider name *</Label>
                <Input
                  id="provider-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Emirates Insurance"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider-name-ar">Arabic name</Label>
                <Input
                  id="provider-name-ar"
                  value={form.nameAr}
                  onChange={(e) => updateField("nameAr", e.target.value)}
                  placeholder="اتحاد للتأمين"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="provider-short-code">Short code *</Label>
                <Input
                  id="provider-short-code"
                  value={form.shortName}
                  onChange={(e) => {
                    setShortCodeTouched(true);
                    updateField("shortName", e.target.value.toUpperCase());
                  }}
                  placeholder="ETIHAD_INS"
                  required
                />
                {!provider && form.name && (
                  <p className="text-xs text-muted-foreground">
                    Internal code: {deriveInsuranceProviderCode(form.name) || "—"}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider-claim-email">Claims email</Label>
                <Input
                  id="provider-claim-email"
                  type="email"
                  value={form.claimEmail}
                  onChange={(e) => updateField("claimEmail", e.target.value)}
                  placeholder="claims@etihad.ae"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Submission method</Label>
                <Select
                  value={form.claimSubmissionMethod}
                  onValueChange={(value) =>
                    updateField("claimSubmissionMethod", value as ClaimSubmissionMethod)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.claimSubmissionMethod === "PORTAL" && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="provider-portal-url">Claims portal URL *</Label>
                  <Input
                    id="provider-portal-url"
                    type="url"
                    value={form.claimsPortalUrl}
                    onChange={(e) => updateField("claimsPortalUrl", e.target.value)}
                    placeholder="https://portal.insurer.com/claims"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="provider-turnaround">Typical turnaround (days)</Label>
                <Input
                  id="provider-turnaround"
                  type="number"
                  min={1}
                  value={form.turnaroundDays}
                  onChange={(e) => updateField("turnaroundDays", e.target.value)}
                  placeholder="14"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="provider-phone">Contact phone</Label>
                <Input
                  id="provider-phone"
                  value={form.contactPhone}
                  onChange={(e) => updateField("contactPhone", e.target.value)}
                  placeholder="+971 2 XXX XXXX"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label htmlFor="provider-preauth">Requires pre-authorization</Label>
                <Switch
                  id="provider-preauth"
                  checked={form.requiresPreAuth}
                  onCheckedChange={(checked) => updateField("requiresPreAuth", checked)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider-notes">Notes</Label>
              <Textarea
                id="provider-notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Additional notes about this provider…"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Network types</Label>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="p-2 font-medium">Code</th>
                      <th className="p-2 font-medium">Name</th>
                      <th className="p-2 font-medium">Co-pay %</th>
                      <th className="p-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.networkTypes.map((row, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="p-2">
                          <Input
                            value={row.code}
                            onChange={(e) =>
                              updateNetwork(index, { code: e.target.value.toUpperCase() })
                            }
                            placeholder="GOLD"
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={row.name}
                            onChange={(e) => updateNetwork(index, { name: e.target.value })}
                            placeholder="Gold Plan"
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={row.defaultCoPayPercent}
                            onChange={(e) =>
                              updateNetwork(index, {
                                defaultCoPayPercent: Number(e.target.value),
                              })
                            }
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={form.networkTypes.length <= 1}
                            onClick={() => removeNetworkRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addNetworkRow}>
                <Plus className="mr-1 h-4 w-4" />
                Add network type
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : provider ? "Save changes" : "Save provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlatformOverrideDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: PlatformProvider;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    claimSubmissionMethod: "MANUAL" as ClaimSubmissionMethod,
    claimEmail: "",
    claimsPortalUrl: "",
    turnaroundDays: "",
  });

  useEffect(() => {
    if (open && provider) {
      setForm({
        claimSubmissionMethod: provider.claimSubmissionMethod ?? "MANUAL",
        claimEmail: provider.claimEmail ?? "",
        claimsPortalUrl: provider.claimsPortalUrl ?? "",
        turnaroundDays: provider.turnaroundDays?.toString() ?? "",
      });
    }
  }, [open, provider]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!provider) return;
    if (form.claimSubmissionMethod === "PORTAL" && !form.claimsPortalUrl.trim()) {
      toast.error("Portal URL is required when submission method is Portal");
      return;
    }

    startTransition(async () => {
      try {
        await overridePlatformInsuranceProvider({
          platformCode: provider.code,
          claimSubmissionMethod: form.claimSubmissionMethod,
          claimEmail: form.claimEmail.trim() || undefined,
          claimsPortalUrl: form.claimsPortalUrl.trim() || undefined,
          turnaroundDays: form.turnaroundDays
            ? Number.parseInt(form.turnaroundDays, 10)
            : undefined,
        });
        toast.success("Submission settings saved");
        onOpenChange(false);
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save settings");
      }
    });
  }

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Override submission settings</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Configure how claims and pre-authorizations are sent to {provider.name}. Platform
            network definitions remain read-only.
          </p>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Submission method</Label>
              <Select
                value={form.claimSubmissionMethod}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    claimSubmissionMethod: value as ClaimSubmissionMethod,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="override-claim-email">Claims email</Label>
              <Input
                id="override-claim-email"
                type="email"
                value={form.claimEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, claimEmail: e.target.value }))}
                placeholder="claims@insurer.com"
              />
            </div>
            {form.claimSubmissionMethod === "PORTAL" && (
              <div className="grid gap-2">
                <Label htmlFor="override-portal-url">Claims portal URL *</Label>
                <Input
                  id="override-portal-url"
                  type="url"
                  value={form.claimsPortalUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, claimsPortalUrl: e.target.value }))
                  }
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="override-turnaround">Typical turnaround (days)</Label>
              <Input
                id="override-turnaround"
                type="number"
                min={1}
                value={form.turnaroundDays}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, turnaroundDays: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomizationClient(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("insurance");
  const [pending, startTransition] = useTransition();
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProvider | undefined>();
  const [platformOverrideOpen, setPlatformOverrideOpen] = useState(false);
  const [editingPlatformProvider, setEditingPlatformProvider] = useState<
    PlatformProvider | undefined
  >();

  const activeCustomProviders = props.customProviders.filter((p) => p.isActive);

  function refreshCustomization() {
    router.refresh();
  }

  function openAddProvider() {
    setEditingProvider(undefined);
    setProviderDialogOpen(true);
  }

  function openEditProvider(provider: CustomProvider) {
    setEditingProvider(provider);
    setProviderDialogOpen(true);
  }

  function deleteProvider(provider: CustomProvider) {
    if (!confirm(`Remove "${provider.name}"? This cannot be undone.`)) return;

    startTransition(async () => {
      try {
        await deleteCustomInsuranceProvider(provider.id);
        toast.success("Provider removed");
        refreshCustomization();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove provider");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clinic Customization</h1>
        <p className="text-muted-foreground">
          {props.tenant?.name} · {props.countryProfile.flag} {props.countryProfile.name}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "insurance" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Platform insurance providers</h2>
          <ul className="divide-y rounded-lg border">
            {props.platformProviders.map((p) => (
              <li
                key={p.code}
                className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">
                    {p.networkTypes.length} network types · pre-auth{" "}
                    {p.requiresPreAuth ? "required" : "optional"}
                    {p.claimSubmissionMethod
                      ? ` · ${p.claimSubmissionMethod.toLowerCase()} submission`
                      : ""}
                    {p.hasTenantOverride ? " · customized" : ""}
                  </p>
                  {(p.claimEmail || p.claimsPortalUrl) && (
                    <p className="text-xs text-muted-foreground">
                      {p.claimEmail ? `Claims: ${p.claimEmail}` : null}
                      {p.claimEmail && p.claimsPortalUrl ? " · " : null}
                      {p.claimsPortalUrl ? `Portal: ${p.claimsPortalUrl}` : null}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPlatformProvider(p);
                    setPlatformOverrideOpen(true);
                  }}
                >
                  {p.hasTenantOverride ? "Edit submission settings" : "Override submission settings"}
                </Button>
              </li>
            ))}
          </ul>

          <h2 className="text-lg font-semibold">Custom providers</h2>
          {activeCustomProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom providers yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {activeCustomProviders.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {p.name}
                      {p.nameAr ? (
                        <span className="ml-2 text-muted-foreground" dir="rtl">
                          ({p.nameAr})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground">
                      Code: {p.code} · Short: {p.shortName}
                      {p.requiresPreAuth ? " · Pre-auth required" : " · Pre-auth optional"}
                    </p>
                    {(p.claimEmail || p.contactPhone) && (
                      <p className="text-muted-foreground">
                        {p.claimEmail ? `Claims: ${p.claimEmail}` : null}
                        {p.claimEmail && p.contactPhone ? " · " : null}
                        {p.contactPhone ? `Tel: ${p.contactPhone}` : null}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      Submission: {p.claimSubmissionMethod.toLowerCase()}
                      {p.turnaroundDays ? ` · ~${p.turnaroundDays} days` : ""}
                      {p.claimsPortalUrl ? ` · Portal configured` : ""}
                    </p>
                    {p.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {p.networkTypes.map((n) => (
                        <span
                          key={`${p.id}-${n.code}`}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {n.code}: {n.name} ({n.defaultCoPayPercent}% co-pay)
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditProvider(p)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => deleteProvider(p)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button type="button" onClick={openAddProvider}>
            <Plus className="mr-2 h-4 w-4" />
            Add custom provider
          </Button>

          <InsuranceProviderDialog
            open={providerDialogOpen}
            onOpenChange={setProviderDialogOpen}
            provider={editingProvider}
            onSaved={refreshCustomization}
          />

          <PlatformOverrideDialog
            open={platformOverrideOpen}
            onOpenChange={setPlatformOverrideOpen}
            provider={editingPlatformProvider}
            onSaved={refreshCustomization}
          />
        </section>
      )}

      {tab === "fields" && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Standard fields are defined by your country ({props.countryProfile.name}).
          </p>
          <ul className="divide-y rounded-lg border">
            {props.customFields.map((f) => (
              <li key={f.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{f.fieldLabel}</p>
                  <p className="text-muted-foreground">
                    {f.fieldKey} · {f.fieldType} · {f.section}
                    {f.isRequired ? " · required" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCustomField(f.id);
                      toast.success("Field removed");
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await createCustomField({
                  entity: "PATIENT",
                  fieldKey: `field_${Date.now()}`,
                  fieldLabel: "New custom field",
                  fieldType: "TEXT",
                  isRequired: false,
                  isPortalVisible: false,
                  section: "ADDITIONAL",
                });
                toast.success("Custom field added");
              })
            }
          >
            + Add custom field
          </button>
        </section>
      )}

      {tab === "payments" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.paymentMethods.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">
                  {m.type}
                  {m.isDefault ? " · default" : ""}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await addPaymentMethod({ name: "Cheque", type: "OTHER" });
                toast.success("Payment method added");
              })
            }
          >
            + Add payment method
          </button>
        </section>
      )}

      {tab === "memberships" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.membershipPlans.map((p) => (
              <li key={p.id} className="p-3 text-sm">
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground">
                  {props.tenant?.currency} {p.price} · {p.discountPercent}% discount ·{" "}
                  {p._count?.members ?? 0} members
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await createMembershipPlan({
                  name: "Annual Care Plan",
                  price: 999,
                  duration: "ANNUAL",
                  discountPercent: 10,
                });
                toast.success("Membership plan created");
              })
            }
          >
            + Add membership plan
          </button>
        </section>
      )}

      {tab === "corporate" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.corporateAccounts.map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <p className="font-medium">{a.companyName}</p>
                <p className="text-muted-foreground">
                  {a.discountPercent}% discount · {a._count?.patients ?? 0} patients
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await createCorporateAccount({
                  companyName: "New Corporate Account",
                  discountPercent: 5,
                  invoicingCycle: "MONTHLY",
                });
                toast.success("Corporate account created");
              })
            }
          >
            + Add corporate account
          </button>
        </section>
      )}

      {tab === "referrals" && (
        <section className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {props.referralContacts.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <p className="font-medium">{r.name}</p>
                <p className="text-muted-foreground">
                  {r.type}
                  {r.specialty ? ` · ${r.specialty}` : ""}
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              startTransition(async () => {
                await addReferralContact({
                  type: "SPECIALIST",
                  name: "New referral contact",
                });
                toast.success("Referral contact added");
              })
            }
          >
            + Add referral contact
          </button>
        </section>
      )}
    </div>
  );
}
