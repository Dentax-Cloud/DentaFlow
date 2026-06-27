"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COUNTRY_OPTIONS,
  MONTHLY_PATIENT_OPTIONS,
  REFERRAL_SOURCES,
  SPECIALTY_OPTIONS,
  TIMEZONE_OPTIONS,
} from "@/lib/auth/countries";
import type { ClinicCustomField, ClinicProfileView } from "@/lib/tenant/clinic-profile";
import { formatProfileRegisteredOn } from "@/lib/tenant/clinic-profile";
import { formatDate } from "@/lib/utils";
import {
  removeClinicCustomField,
  updateClinicProfile,
  upsertClinicCustomField,
} from "@/app/(dashboard)/features/clinic-profile/actions";

type Props = {
  profile: ClinicProfileView;
  canEdit: boolean;
  countryConfig?: {
    code: string;
    flag: string;
    name: string;
    currency: string;
    taxName: string;
    taxRate: number;
    regulatoryBody: string;
    toothNumbering: string;
    workingDays: string;
  };
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{value}</dd>
    </div>
  );
}

export function ClinicProfileClient({ profile, canEdit, countryConfig }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState<ClinicCustomField[]>(
    profile.metadata.customFields ?? [],
  );
  const [newField, setNewField] = useState({ label: "", value: "" });
  const [fieldSaving, setFieldSaving] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    logoUrl: profile.logoUrl ?? "",
    addressLine1: profile.metadata.addressLine1 ?? "",
    addressLine2: profile.metadata.addressLine2 ?? "",
    city: profile.city ?? "",
    state: profile.metadata.state ?? "",
    postalCode: profile.metadata.postalCode ?? "",
    country: profile.country ?? "AE",
    timezone: profile.timezone,
    locale: profile.locale,
    currency: profile.currency,
    taxId: profile.metadata.taxId ?? "",
    doctorCount: profile.metadata.doctorCount ?? profile.chairCount,
    expectedMonthlyPatients: profile.metadata.expectedMonthlyPatients ?? "",
    referralSource: profile.metadata.referralSource ?? "",
    specialties: profile.metadata.specialties ?? [],
  });

  function toggleSpecialty(specialty: string) {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    const result = await updateClinicProfile({
      ...form,
      doctorCount: Number(form.doctorCount) || 1,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Clinic profile updated");
    router.refresh();
  }

  async function handleAddCustomField(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !newField.label.trim()) return;
    setFieldSaving("new");
    const result = await upsertClinicCustomField(newField);
    setFieldSaving(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setCustomFields((prev) => [...prev, result.data]);
    setNewField({ label: "", value: "" });
    toast.success("Custom field added");
    router.refresh();
  }

  async function handleRemoveField(id: string) {
    if (!canEdit) return;
    setFieldSaving(id);
    const result = await removeClinicCustomField({ id });
    setFieldSaving(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
    toast.success("Field removed");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {profile.logoUrl ? (
              <Image
                src={profile.logoUrl}
                alt={profile.name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{profile.name}</h1>
            <p className="text-muted-foreground">Clinic profile & registration details</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.status}</Badge>
              <Badge variant="outline">{profile.subscriptionPlan}</Badge>
              <Badge variant="outline">{profile.subscriptionStatus}</Badge>
            </div>
          </div>
        </div>
      </div>

      {countryConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Country configuration</CardTitle>
            <CardDescription>
              These settings are determined by your registered country. Contact support to update your
              country.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <DetailRow
              label="Country"
              value={`${countryConfig.flag} ${countryConfig.name} (${countryConfig.code})`}
            />
            <DetailRow label="Currency" value={countryConfig.currency} />
            <DetailRow
              label="Tax"
              value={`${countryConfig.taxName} ${countryConfig.taxRate}%`}
            />
            <DetailRow label="Regulatory body" value={countryConfig.regulatoryBody} />
            <DetailRow label="Tooth numbering" value={countryConfig.toothNumbering} />
            <DetailRow label="Working days" value={countryConfig.workingDays.replace(/,/g, ", ")} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Registered details</CardTitle>
            <CardDescription>
              Information collected during clinic registration.{" "}
              {canEdit ? "Edit and save changes below." : "Read-only for your role."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Clinic name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4" /> Address
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="addressLine1">Street address</Label>
                      <Input
                        id="addressLine1"
                        value={form.addressLine1}
                        onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="addressLine2">Address line 2</Label>
                      <Input
                        id="addressLine2"
                        value={form.addressLine2}
                        onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State / Emirate</Label>
                      <Input
                        id="state"
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal code</Label>
                      <Input
                        id="postalCode"
                        value={form.postalCode}
                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <select
                        id="country"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                      >
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <select
                      id="timezone"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.timezone}
                      onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doctorCount">Doctors / specialists</Label>
                    <Input
                      id="doctorCount"
                      type="number"
                      min={1}
                      value={form.doctorCount}
                      onChange={(e) =>
                        setForm({ ...form, doctorCount: parseInt(e.target.value, 10) || 1 })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="taxId">
                    {COUNTRY_OPTIONS.find((c) => c.code === form.country)?.taxLabel ?? "Tax ID"}
                  </Label>
                  <Input
                    id="taxId"
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  />
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label>Specialties / services</Label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTY_OPTIONS.map((specialty) => (
                      <button
                        key={specialty}
                        type="button"
                        onClick={() => toggleSpecialty(specialty)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          form.specialties.includes(specialty)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {specialty}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="expectedMonthlyPatients">Expected monthly patients</Label>
                    <select
                      id="expectedMonthlyPatients"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.expectedMonthlyPatients}
                      onChange={(e) =>
                        setForm({ ...form, expectedMonthlyPatients: e.target.value })
                      }
                    >
                      <option value="">Not set</option>
                      {MONTHLY_PATIENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referralSource">Referral source</Label>
                    <select
                      id="referralSource"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.referralSource}
                      onChange={(e) => setForm({ ...form, referralSource: e.target.value })}
                    >
                      <option value="">Not set</option>
                      {REFERRAL_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save profile
                </Button>
              </form>
            ) : (
              <dl className="space-y-4">
                <DetailRow label="Clinic name" value={profile.name} />
                <DetailRow label="Email" value={profile.email} />
                <DetailRow label="Phone" value={profile.phone} />
                <DetailRow label="Address" value={profile.address} />
                <DetailRow label="City" value={profile.city} />
                <DetailRow label="Country" value={profile.countryName} />
                <DetailRow label="Timezone" value={profile.timezone} />
                <DetailRow label="Currency" value={profile.currency} />
                <DetailRow label="Operatories" value={profile.chairCount} />
                <DetailRow label="Doctors" value={profile.metadata.doctorCount} />
                <DetailRow
                  label="Tax ID"
                  value={
                    profile.metadata.taxId
                      ? `${profile.metadata.taxIdType ?? "Tax ID"}: ${profile.metadata.taxId}`
                      : null
                  }
                />
                <DetailRow
                  label="Specialties"
                  value={
                    profile.metadata.specialties?.length
                      ? profile.metadata.specialties.join(", ")
                      : null
                  }
                />
                <DetailRow
                  label="Expected volume"
                  value={profile.expectedMonthlyPatientsLabel}
                />
                <DetailRow label="Referral source" value={profile.metadata.referralSource} />
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Workspace slug" value={profile.slug} />
              <DetailRow label="Registered" value={formatProfileRegisteredOn(profile.createdAt)} />
              <DetailRow
                label="Trial ends"
                value={profile.trialEndsAt ? formatDate(profile.trialEndsAt) : "—"}
              />
              <DetailRow label="Locale" value={profile.locale} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom fields</CardTitle>
              <CardDescription>Add clinic-specific details not captured at registration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customFields.length === 0 && (
                <p className="text-sm text-muted-foreground">No custom fields yet.</p>
              )}
              {customFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-start justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                    <p className="text-sm">{field.value || "—"}</p>
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      disabled={fieldSaving === field.id}
                      onClick={() => handleRemoveField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {canEdit && (
                <form onSubmit={handleAddCustomField} className="space-y-3 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="customLabel">Field label</Label>
                    <Input
                      id="customLabel"
                      placeholder="e.g. License number, Website"
                      value={newField.label}
                      onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customValue">Value</Label>
                    <Textarea
                      id="customValue"
                      rows={2}
                      value={newField.value}
                      onChange={(e) => setNewField({ ...newField, value: e.target.value })}
                    />
                  </div>
                  <Button type="submit" size="sm" variant="outline" disabled={fieldSaving === "new"}>
                    {fieldSaving === "new" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add field
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
