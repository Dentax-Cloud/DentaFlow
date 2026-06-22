import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantStatusBadge } from "@/components/super-admin/tenant-status-badge";
import { ImpersonateButton } from "@/components/super-admin/impersonate-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  reinstateTenantAction,
  suspendTenantAction,
} from "../actions";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      branches: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: true },
      },
      _count: {
        select: {
          patients: true,
          appointments: true,
          staffMembers: true,
        },
      },
    },
  });

  if (!tenant || tenant.deletedAt) notFound();

  const revenue = await db.payment.aggregate({
    where: { tenantId: id },
    _sum: { amount: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-zinc-400">
            <Link href="/superadmin/tenants">← All tenants</Link>
          </Button>
          <h2 className="text-2xl font-bold">{tenant.name}</h2>
          <p className="text-sm text-zinc-400">/{tenant.slug}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <TenantStatusBadge status={tenant.status} />
            <Badge variant="outline">{tenant.subscriptionPlan}</Badge>
            <Badge
              variant={
                tenant.subscriptionStatus === "ACTIVE"
                  ? "success"
                  : tenant.subscriptionStatus === "TRIALING"
                    ? "default"
                    : "warning"
              }
            >
              {tenant.subscriptionStatus}
            </Badge>
          </div>
        </div>
        <ImpersonateButton tenantId={tenant.id} tenantName={tenant.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Patients", value: tenant._count.patients },
          { label: "Appointments", value: tenant._count.appointments },
          { label: "Staff", value: tenant._count.staffMembers },
          { label: "Revenue", value: formatCurrency(Number(revenue._sum.amount ?? 0)) },
        ].map((s) => (
          <Card key={s.label} className="border-white/10 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle>Clinic info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-zinc-500">Email:</span> {tenant.email ?? "—"}
          </p>
          <p>
            <span className="text-zinc-500">Phone:</span> {tenant.phone ?? "—"}
          </p>
          <p>
            <span className="text-zinc-500">Created:</span> {formatDate(tenant.createdAt)}
          </p>
          <p>
            <span className="text-zinc-500">Trial ends:</span>{" "}
            {tenant.trialEndsAt ? formatDate(tenant.trialEndsAt) : "—"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle>Branches ({tenant.branches.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenant.branches.length === 0 && (
            <p className="text-sm text-zinc-500">No branches configured.</p>
          )}
          {tenant.branches.map((b) => (
            <div key={b.id} className="flex justify-between border-b border-white/10 pb-2 text-sm">
              <span>
                {b.name}
                {b.isPrimary && (
                  <Badge className="ml-2" variant="secondary">
                    Primary
                  </Badge>
                )}
              </span>
              <span className="text-zinc-500">{b.address ?? "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-zinc-900/50">
        <CardHeader>
          <CardTitle>Recent audit log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {tenant.auditLogs.map((log) => (
            <div key={log.id} className="flex justify-between border-b border-white/10 pb-2">
              <span>
                {log.action} {log.entity}
                {log.user &&
                  ` · ${log.user.firstName ?? ""} ${log.user.lastName ?? log.user.email}`}
              </span>
              <span className="text-zinc-500">{formatDate(log.createdAt)}</span>
            </div>
          ))}
          {tenant.auditLogs.length === 0 && (
            <p className="text-zinc-500">No audit events yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tenant.status === "SUSPENDED" ? (
            <form action={reinstateTenantAction.bind(null, tenant.id)}>
              <Button type="submit" variant="outline">
                Reinstate clinic
              </Button>
            </form>
          ) : (
            <form action={suspendTenantAction.bind(null, tenant.id)}>
              <Button type="submit" variant="destructive">
                Suspend clinic
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
