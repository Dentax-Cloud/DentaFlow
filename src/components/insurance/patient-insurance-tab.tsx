"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Shield } from "lucide-react";
import { PhotoCapture } from "@/components/profile/photo-capture";
import { InsuranceStatusBadge } from "@/components/insurance/insurance-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInsurancePolicy,
  deactivateInsurancePolicy,
  setVerificationStatus,
  updateInsurancePolicy,
} from "@/app/(dashboard)/features/insurance/insurance-policy-actions";
import {
  INSURANCE_VERIFICATION_STATUSES,
  SUBSCRIBER_RELATIONSHIPS,
  type InsuranceVerificationStatus,
  type PolicyRank,
  type SerializedInsurancePolicy,
} from "@/lib/insurance/policy-types";
import { formatDate } from "@/lib/utils";

type InsuranceProviderOption = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  networkTypes: Array<{ code: string; name: string }>;
  source: "platform" | "tenant";
};

type Props = {
  patientId: string;
  policies: SerializedInsurancePolicy[];
  providers: InsuranceProviderOption[];
  canWrite: boolean;
  uploadsEnabled: boolean;
  showUploadConfigHint?: boolean;
};

type FormState = {
  rank: PolicyRank;
  providerKey: string;
  providerNameFreeText: string;
  networkTier: string;
  memberId: string;
  groupNumber: string;
  subscriberName: string;
  subscriberRelationship: string;
  effectiveDate: string;
  expiryDate: string;
};

const FREE_TEXT_PROVIDER = "__free_text__";

function emptyForm(rank: PolicyRank): FormState {
  return {
    rank,
    providerKey: "",
    providerNameFreeText: "",
    networkTier: "",
    memberId: "",
    groupNumber: "",
    subscriberName: "",
    subscriberRelationship: "SELF",
    effectiveDate: "",
    expiryDate: "",
  };
}

function policyToForm(
  policy: SerializedInsurancePolicy,
  providers: InsuranceProviderOption[],
): FormState {
  const matched = providers.find(
    (p) =>
      (policy.providerId && p.id === policy.providerId) ||
      (!policy.providerId && p.name === policy.providerDisplayName),
  );
  return {
    rank: policy.rank,
    providerKey: matched?.id ?? (policy.providerNameFreeText ? FREE_TEXT_PROVIDER : ""),
    providerNameFreeText: policy.providerNameFreeText ?? policy.providerDisplayName,
    networkTier: policy.networkTier ?? "",
    memberId: policy.memberId,
    groupNumber: policy.groupNumber ?? "",
    subscriberName: policy.subscriberName ?? "",
    subscriberRelationship: policy.subscriberRelationship ?? "SELF",
    effectiveDate: policy.effectiveDate?.slice(0, 10) ?? "",
    expiryDate: policy.expiryDate?.slice(0, 10) ?? "",
  };
}

function resolveProviderPayload(form: FormState, providers: InsuranceProviderOption[]) {
  if (form.providerKey === FREE_TEXT_PROVIDER) {
    return {
      providerId: null,
      providerNameFreeText: form.providerNameFreeText.trim() || null,
    };
  }
  const selected = providers.find((p) => p.id === form.providerKey);
  if (!selected) {
    return {
      providerId: null,
      providerNameFreeText: form.providerNameFreeText.trim() || null,
    };
  }
  return {
    providerId: selected.source === "tenant" ? selected.id : null,
    providerNameFreeText: selected.name,
  };
}

export function PatientInsuranceTab({
  patientId,
  policies,
  providers,
  canWrite,
  uploadsEnabled,
  showUploadConfigHint,
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new-primary" | "new-secondary" | null>(null);
  const [saving, setSaving] = useState(false);

  const primary = policies.find((p) => p.rank === "PRIMARY");
  const secondary = policies.find((p) => p.rank === "SECONDARY");

  const refresh = () => router.refresh();

  function startEdit(policy: SerializedInsurancePolicy) {
    setEditingId(policy.id);
  }

  function startCreate(rank: PolicyRank) {
    setEditingId(rank === "PRIMARY" ? "new-primary" : "new-secondary");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Shield className="h-4 w-4" />
        <p className="text-sm">
          Primary and secondary coverage with verification status. Legacy patient insurance fields
          remain available for billing until claims go live.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PolicyCardView
          title="Primary insurance"
          policy={primary}
          rank="PRIMARY"
          patientId={patientId}
          providers={providers}
          canWrite={canWrite}
          uploadsEnabled={uploadsEnabled}
          showUploadConfigHint={showUploadConfigHint}
          editing={editingId === primary?.id || editingId === "new-primary"}
          onEdit={() => (primary ? startEdit(primary) : startCreate("PRIMARY"))}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            refresh();
          }}
          saving={saving}
          setSaving={setSaving}
        />
        <PolicyCardView
          title="Secondary insurance"
          policy={secondary}
          rank="SECONDARY"
          patientId={patientId}
          providers={providers}
          canWrite={canWrite}
          uploadsEnabled={uploadsEnabled}
          showUploadConfigHint={showUploadConfigHint}
          editing={editingId === secondary?.id || editingId === "new-secondary"}
          onEdit={() => (secondary ? startEdit(secondary) : startCreate("SECONDARY"))}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            refresh();
          }}
          saving={saving}
          setSaving={setSaving}
          showAddButton={!secondary && !!primary}
          onAdd={() => startCreate("SECONDARY")}
        />
      </div>
    </div>
  );
}

function PolicyCardView({
  title,
  policy,
  rank,
  patientId,
  providers,
  canWrite,
  uploadsEnabled,
  showUploadConfigHint,
  editing,
  onEdit,
  onCancel,
  onSaved,
  saving,
  setSaving,
  showAddButton,
  onAdd,
}: {
  title: string;
  policy?: SerializedInsurancePolicy;
  rank: PolicyRank;
  patientId: string;
  providers: InsuranceProviderOption[];
  canWrite: boolean;
  uploadsEnabled: boolean;
  showUploadConfigHint?: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  showAddButton?: boolean;
  onAdd?: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    policy ? policyToForm(policy, providers) : emptyForm(rank),
  );
  const [verificationStatus, setLocalVerificationStatus] = useState<InsuranceVerificationStatus | "">(
    policy?.verificationStatus ?? "",
  );

  useEffect(() => {
    if (editing) {
      setForm(policy ? policyToForm(policy, providers) : emptyForm(rank));
    }
  }, [editing, policy, providers, rank]);

  const selectedProvider = providers.find((p) => p.id === form.providerKey);
  const networkOptions = useMemo(
    () => selectedProvider?.networkTypes ?? [],
    [selectedProvider],
  );

  async function handleSave() {
    if (!form.memberId.trim()) {
      toast.error("Member ID is required");
      return;
    }
    setSaving(true);
    const providerPayload = resolveProviderPayload(form, providers);
    const payload = {
      rank,
      ...providerPayload,
      networkTier: form.networkTier || null,
      memberId: form.memberId,
      groupNumber: form.groupNumber || null,
      subscriberName: form.subscriberName || null,
      subscriberRelationship: (form.subscriberRelationship ||
        null) as (typeof SUBSCRIBER_RELATIONSHIPS)[number] | null,
      effectiveDate: form.effectiveDate || null,
      expiryDate: form.expiryDate || null,
    };

    const result = policy
      ? await updateInsurancePolicy({ policyId: policy.id, ...payload })
      : await createInsurancePolicy({ patientId, ...payload });

    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(policy ? "Policy updated" : "Policy created");
    onSaved();
  }

  async function handleVerificationChange(status: InsuranceVerificationStatus) {
    if (!policy) return;
    setSaving(true);
    const result = await setVerificationStatus({ policyId: policy.id, status });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setLocalVerificationStatus(status);
    toast.success("Verification status updated");
    onSaved();
  }

  async function handleDeactivate() {
    if (!policy) return;
    setSaving(true);
    const result = await deactivateInsurancePolicy({ policyId: policy.id });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Policy deactivated");
    onSaved();
  }

  const displayStatus =
    policy?.effectiveVerificationStatus ??
    (verificationStatus as InsuranceVerificationStatus) ??
    "NOT_VERIFIED";

  if (!policy && !editing) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>No policy on file</CardDescription>
        </CardHeader>
        <CardContent>
          {showAddButton && onAdd ? (
            <Button type="button" variant="outline" onClick={onAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add secondary insurance
            </Button>
          ) : canWrite ? (
            <Button type="button" variant="outline" onClick={onEdit}>
              <Plus className="mr-2 h-4 w-4" />
              Add {rank.toLowerCase()} insurance
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Not configured</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {policy && (
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
              <InsuranceStatusBadge status={displayStatus} />
              {policy.expiryDate && (
                <span className="text-xs">Expires {formatDate(policy.expiryDate)}</span>
              )}
            </CardDescription>
          )}
        </div>
        {canWrite && policy && !editing && (
          <Button type="button" variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Insurance provider</Label>
              <Select
                value={form.providerKey}
                onValueChange={(v) => setForm((f) => ({ ...f, providerKey: v, networkTier: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={FREE_TEXT_PROVIDER}>Other (free text)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.providerKey === FREE_TEXT_PROVIDER && (
              <div className="space-y-2">
                <Label>Provider name</Label>
                <Input
                  value={form.providerNameFreeText}
                  onChange={(e) => setForm((f) => ({ ...f, providerNameFreeText: e.target.value }))}
                />
              </div>
            )}
            {networkOptions.length > 0 ? (
              <div className="space-y-2">
                <Label>Network tier</Label>
                <Select
                  value={form.networkTier}
                  onValueChange={(v) => setForm((f) => ({ ...f, networkTier: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {networkOptions.map((n) => (
                      <SelectItem key={n.code} value={n.code}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Network tier</Label>
                <Input
                  value={form.networkTier}
                  onChange={(e) => setForm((f) => ({ ...f, networkTier: e.target.value }))}
                  placeholder="e.g. Basic, Enhanced, VIP"
                />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Member ID</Label>
                <Input
                  value={form.memberId}
                  onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Group number</Label>
                <Input
                  value={form.groupNumber}
                  onChange={(e) => setForm((f) => ({ ...f, groupNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subscriber name</Label>
                <Input
                  value={form.subscriberName}
                  onChange={(e) => setForm((f) => ({ ...f, subscriberName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Select
                  value={form.subscriberRelationship}
                  onValueChange={(v) => setForm((f) => ({ ...f, subscriberRelationship: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSCRIBER_RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Effective date</Label>
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving..." : "Save policy"}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : policy ? (
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="font-medium">{policy.providerDisplayName}</dd>
            </div>
            {policy.networkTier && (
              <div>
                <dt className="text-muted-foreground">Network</dt>
                <dd>{policy.networkTier}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Member ID</dt>
              <dd className="font-mono">{policy.memberId}</dd>
            </div>
            {policy.groupNumber && (
              <div>
                <dt className="text-muted-foreground">Group number</dt>
                <dd>{policy.groupNumber}</dd>
              </div>
            )}
            {policy.verifiedAt && (
              <div>
                <dt className="text-muted-foreground">Last verified</dt>
                <dd>
                  {formatDate(policy.verifiedAt)}
                  {policy.verificationExpiresAt && (
                    <span className="text-muted-foreground">
                      {" "}
                      · valid until {formatDate(policy.verificationExpiresAt)}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        ) : null}

        {policy && canWrite && !editing && (
          <div className="space-y-2 border-t pt-4">
            <Label>Verification status</Label>
            <Select
              value={displayStatus}
              onValueChange={(v) => void handleVerificationChange(v as InsuranceVerificationStatus)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSURANCE_VERIFICATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {policy && canWrite && !editing && (
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Card front</p>
              <PhotoCapture
                mode="insuranceCard"
                policyId={policy.id}
                side="front"
                currentPhotoUrl={policy.cardFrontUrl}
                label="Insurance card (front)"
                uploadsEnabled={uploadsEnabled}
                showAdminConfigHint={showUploadConfigHint}
                onPhotoUpdated={() => onSaved()}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Card back</p>
              <PhotoCapture
                mode="insuranceCard"
                policyId={policy.id}
                side="back"
                currentPhotoUrl={policy.cardBackUrl}
                label="Insurance card (back)"
                uploadsEnabled={uploadsEnabled}
                showAdminConfigHint={showUploadConfigHint}
                onPhotoUpdated={() => onSaved()}
              />
            </div>
          </div>
        )}

        {policy && canWrite && !editing && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => void handleDeactivate()}
            disabled={saving}
          >
            Deactivate policy
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
