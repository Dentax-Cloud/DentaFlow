"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTenantPlan } from "@/app/superadmin/tenants/actions";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { SubscriptionStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const PLANS: {
  value: SubscriptionPlan;
  label: string;
  price: string;
  limits: string;
  color: string;
}[] = [
  {
    value: "STARTER",
    label: "Starter",
    price: "Free trial / $49/mo",
    limits: "200 patients · 5 staff · 1 branch",
    color: "border-zinc-500",
  },
  {
    value: "PROFESSIONAL",
    label: "Professional",
    price: "$149/mo",
    limits: "1,000 patients · 20 staff · 5 branches",
    color: "border-sky-500",
  },
  {
    value: "ENTERPRISE",
    label: "Enterprise",
    price: "$399/mo",
    limits: "Unlimited patients · staff · branches",
    color: "border-purple-500",
  },
];

const STATUSES: { value: SubscriptionStatus; label: string }[] = [
  { value: "TRIALING", label: "Trialing" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAST_DUE", label: "Past due" },
  { value: "PAUSED", label: "Paused" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELED", label: "Canceled" },
];

export function PlanUpgradeForm({
  tenantId,
  currentPlan,
  currentStatus,
}: {
  tenantId: string;
  currentPlan: SubscriptionPlan;
  currentStatus: SubscriptionStatus;
}) {
  const [plan, setPlan] = useState<SubscriptionPlan>(currentPlan);
  const [status, setStatus] = useState<SubscriptionStatus>(currentStatus);
  const [extendDays, setExtendDays] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const changed = plan !== currentPlan || status !== currentStatus || extendDays !== "" || reason !== "";

  async function handleSave() {
    setLoading(true);
    setSuccess(false);
    try {
      await updateTenantPlan(tenantId, plan, status, {
        extendTrialDays: extendDays ? parseInt(extendDays, 10) : undefined,
        reason: reason || undefined,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Select plan</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPlan(p.value)}
              className={cn(
                "rounded-lg border-2 p-3 text-left transition-all",
                plan === p.value
                  ? `${p.color} bg-white/5`
                  : "border-white/10 hover:border-white/20",
              )}
            >
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{p.price}</p>
              <p className="mt-1 text-xs text-zinc-500">{p.limits}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Subscription status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
            <SelectTrigger className="border-white/10 bg-zinc-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="extend-trial">Extend trial (days)</Label>
          <Input
            id="extend-trial"
            type="number"
            min={1}
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            placeholder="e.g. 14"
            className="border-white/10 bg-zinc-900"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="plan-reason">
          Reason / note{" "}
          <span className="font-normal text-zinc-500">(optional — included in email)</span>
        </Label>
        <Textarea
          id="plan-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Complimentary upgrade for beta testing"
          rows={2}
          className="resize-none border-white/10 bg-zinc-900"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={loading || !changed}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        {success && (
          <span className="text-sm font-medium text-emerald-400">
            Plan updated — notification sent to clinic
          </span>
        )}
        {changed && !loading && !success && (
          <span className="text-xs text-zinc-500">
            {currentPlan !== plan && `Plan: ${currentPlan} → ${plan}`}
            {currentPlan !== plan && currentStatus !== status && " · "}
            {currentStatus !== status && `Status: ${currentStatus} → ${status}`}
          </span>
        )}
      </div>
    </div>
  );
}
