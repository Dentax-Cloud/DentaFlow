import Link from "next/link";
import { db } from "@/lib/db";
import { SubscriptionStatus, TenantStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SUBSCRIPTION_PLAN_VALUES } from "@/lib/subscription/plan-types";
import {
  approveTenantAction,
  rejectTenantAction,
  reinstateTenantAction,
  suspendTenantAction,
  updateTenantPlanForm,
  updateTenantStatusForm,
} from "./actions";
import { TenantStatusBadge } from "@/components/super-admin/tenant-status-badge";
import { ImpersonateButton } from "@/components/super-admin/impersonate-button";

export const runtime = "nodejs";

export default async function SuperadminTenantsPage() {
  const [tenants, pendingTenants] = await Promise.all([
    db.tenant.findMany({
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
    }),
    db.tenant.findMany({
      where: { deletedAt: null, status: TenantStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Tenants</h2>
          <p className="text-sm text-zinc-400">
            Manage subscription plans and status across all clinics.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/superadmin">Platform overview</Link>
        </Button>
      </div>

      {pendingTenants.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-amber-300">
              Approval queue ({pendingTenants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTenants.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.email ?? "No email"}</p>
                </div>
                <div className="flex gap-2">
                  <form action={approveTenantAction.bind(null, t.id)}>
                    <Button type="submit" size="sm" variant="secondary">
                      Approve
                    </Button>
                  </form>
                  <form action={rejectTenantAction.bind(null, t.id)}>
                    <Button type="submit" size="sm" variant="destructive">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Clinic status</th>
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
                  <Link
                    href={`/superadmin/tenants/${tenant.id}`}
                    className="font-medium hover:text-sky-400"
                  >
                    {tenant.name}
                  </Link>
                  <div className="text-xs text-zinc-500">/{tenant.slug}</div>
                  <ImpersonateButton tenantId={tenant.id} tenantName={tenant.name} />
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
