"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SUBSCRIPTION_PLAN_VALUES } from "@/lib/subscription/plan-types";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { SubscriptionStatus } from "@prisma/client";
import { updateTenantPlan } from "@/app/superadmin/tenants/actions";
import { Loader2 } from "lucide-react";

export function TenantPlanQuickSelect({
  tenantId,
  currentPlan,
  currentStatus,
}: {
  tenantId: string;
  currentPlan: SubscriptionPlan;
  currentStatus: SubscriptionStatus;
}) {
  const [plan, setPlan] = useState(currentPlan);
  const [status, setStatus] = useState(currentStatus);
  const [planLoading, setPlanLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  async function handlePlanChange(nextPlan: SubscriptionPlan) {
    setPlan(nextPlan);
    setPlanLoading(true);
    try {
      await updateTenantPlan(tenantId, nextPlan, SubscriptionStatus.ACTIVE);
      toast.success(`Plan updated to ${nextPlan}`);
    } catch {
      setPlan(currentPlan);
      toast.error("Failed to update plan");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleStatusChange(nextStatus: SubscriptionStatus) {
    setStatus(nextStatus);
    setStatusLoading(true);
    try {
      await updateTenantPlan(tenantId, plan, nextStatus);
      toast.success(`Subscription status set to ${nextStatus}`);
    } catch {
      setStatus(currentStatus);
      toast.error("Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={plan}
          disabled={planLoading}
          onChange={(e) => void handlePlanChange(e.target.value as SubscriptionPlan)}
          className="h-9 rounded-md border border-white/10 bg-zinc-900 px-2 text-sm"
        >
          {SUBSCRIPTION_PLAN_VALUES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {planLoading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={status}
          disabled={statusLoading}
          onChange={(e) => void handleStatusChange(e.target.value as SubscriptionStatus)}
          className="h-9 rounded-md border border-white/10 bg-zinc-900 px-2 text-sm"
        >
          {Object.values(SubscriptionStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {statusLoading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>
    </div>
  );
}
