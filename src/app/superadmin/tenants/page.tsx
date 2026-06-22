import { db } from "@/lib/db";
import { SubscriptionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLAN_VALUES } from "@/lib/subscription/plan-types";
import {
  reinstateTenantAction,
  suspendTenantAction,
  updateTenantPlanForm,
  updateTenantStatusForm,
} from "./actions";
import { TenantStatusBadge } from "@/components/super-admin/tenant-status-badge";

export const runtime = "nodejs";

export default async function SuperadminTenantsPage() {
  const tenants = await db.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tenants</h2>
        <p className="text-sm text-zinc-400">
          Manage subscription plans and status across all clinics.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <div className="font-medium">{tenant.name}</div>
                  <div className="text-xs text-zinc-500">/{tenant.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <TenantStatusBadge status={tenant.status} />
                </td>
                <td className="px-4 py-3">{tenant.subscriptionPlan}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      tenant.subscriptionStatus === "TRIALING"
                        ? "default"
                        : tenant.subscriptionStatus === "ACTIVE"
                          ? "success"
                          : tenant.subscriptionStatus === "PAST_DUE"
                            ? "warning"
                            : "secondary"
                    }
                  >
                    {tenant.subscriptionStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {tenant.stripeSubscriptionId ? "Active" : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <form
                      action={updateTenantPlanForm.bind(null, tenant.id)}
                      className="flex items-center gap-2"
                    >
                      <select
                        name="plan"
                        defaultValue={tenant.subscriptionPlan}
                        className="h-9 rounded-md border border-white/10 bg-zinc-900 px-2 text-sm"
                      >
                        {SUBSCRIPTION_PLAN_VALUES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="secondary">
                        Plan
                      </Button>
                    </form>
                    <form
                      action={updateTenantStatusForm.bind(null, tenant.id)}
                      className="flex items-center gap-2"
                    >
                      <select
                        name="status"
                        defaultValue={tenant.subscriptionStatus}
                        className="h-9 rounded-md border border-white/10 bg-zinc-900 px-2 text-sm"
                      >
                        {Object.values(SubscriptionStatus).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="secondary">
                        Sub
                      </Button>
                    </form>
                    {tenant.status === "SUSPENDED" ? (
                      <form action={reinstateTenantAction.bind(null, tenant.id)}>
                        <Button type="submit" size="sm" variant="outline">
                          Reinstate
                        </Button>
                      </form>
                    ) : (
                      <form action={suspendTenantAction.bind(null, tenant.id)}>
                        <Button type="submit" size="sm" variant="destructive">
                          Suspend
                        </Button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
