import Link from "next/link";
import Image from "next/image";
import type { AuditLog, Branch, StaffMember, Tenant } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlanUpgradeForm } from "@/components/super-admin/plan-upgrade-form";
import { SubscriptionStatusBadge } from "@/components/super-admin/subscription-status-badge";
import { TenantStatusBadge } from "@/components/super-admin/tenant-status-badge";
import type { StripeInvoiceItem } from "@/app/(dashboard)/features/subscription/subscription-types";
import { getCountryProfile } from "@/lib/countries";
import { parseMetadataForUpdate } from "@/lib/tenant/clinic-profile";
import { getTrialDaysRemaining } from "@/lib/tenant/trial";
import {
  displayValue,
  formatStructuredAddress,
  formatUsageLimit,
  getEffectiveFeatureRows,
  isTenantAccessBlocked,
  NOT_PROVIDED,
  trialUrgencyClass,
} from "@/lib/super-admin/tenant-detail-helpers";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DetailField, DetailSection } from "./detail-field";
import { TenantAuditLogSection } from "./tenant-audit-log-section";
import {
  deleteTenantAccountAction,
  reinstateTenantAction,
  suspendTenantAction,
} from "@/app/superadmin/tenants/actions";
import { DeleteTenantAccountButton } from "@/components/super-admin/delete-tenant-account-button";

type OwnerInfo = {
  name: string;
  email: string;
  joinedAt: Date;
} | null;

type UsageData = {
  patients: { used: number; max: number; pct: number };
  staff: { used: number; max: number; pct: number };
  branches: { used: number; max: number; pct: number };
};

type ActivityProxies = {
  latestAudit: { action: string; entity: string; createdAt: Date } | null;
  latestAppointment: { title: string; startTime: Date; status: string } | null;
  latestStaff: { name: string; createdAt: Date } | null;
};

type AuditRow = AuditLog & { user: StaffMember | null };

type Props = {
  tenant: Tenant;
  branches: Branch[];
  owner: OwnerInfo;
  usage: UsageData;
  totalRevenue: number;
  stripeHistory: StripeInvoiceItem[] | null;
  stripeHistoryError: boolean;
  activity: ActivityProxies;
  auditLogs: AuditRow[];
  auditTotalCount: number;
  auditPage: number;
  auditPageSize: number;
};

function UsageBar({
  label,
  used,
  max,
  pct,
}: {
  label: string;
  used: number;
  max: number;
  pct: number;
}) {
  const unlimited = max === -1;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium">{formatUsageLimit(used, max)}</span>
      </div>
      {!unlimited && <Progress value={Math.min(pct, 100)} className="h-2" />}
    </div>
  );
}

export function TenantDetailView({
  tenant,
  branches,
  owner,
  usage,
  totalRevenue,
  stripeHistory,
  stripeHistoryError,
  activity,
  auditLogs,
  auditTotalCount,
  auditPage,
  auditPageSize,
}: Props) {
  const metadata = parseMetadataForUpdate(tenant.metadata);
  const countryCode = tenant.countryCode || tenant.country || "AE";
  const country = getCountryProfile(countryCode);
  const trialDays = getTrialDaysRemaining(tenant.trialEndsAt);
  const accessBlocked = isTenantAccessBlocked(tenant);
  const featureRows = getEffectiveFeatureRows(tenant);
  const booleanFeatures = featureRows.filter((f) =>
    ["aiEnabled", "patientPortal", "inventory", "crm", "multiBranch"].includes(f.key),
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start gap-4">
        {tenant.logoUrl ? (
          <Image
            src={tenant.logoUrl}
            alt={`${tenant.name} logo`}
            width={64}
            height={64}
            className="rounded-lg border border-white/10 object-contain"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-2xl">
            {country.flag}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-zinc-400">
            <Link href="/superadmin/tenants">← All tenants</Link>
          </Button>
          <h2 className="text-2xl font-bold">{tenant.name}</h2>
          <p className="text-sm text-zinc-400">/{tenant.slug}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>
              {country.flag} {country.name}
            </span>
            {tenant.tenantCode && (
              <span className="font-mono text-xs text-zinc-500">{tenant.tenantCode}</span>
            )}
            {tenant.globalTenantId && (
              <span className="font-mono text-xs text-zinc-500">{tenant.globalTenantId}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <TenantStatusBadge status={tenant.status} />
            <Badge variant="outline">{tenant.subscriptionPlan}</Badge>
            <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
            {accessBlocked && (
              <Badge variant="warning">Access restricted</Badge>
            )}
          </div>
        </div>
      </div>

      {/* BUSINESS IDENTITY */}
      <DetailSection title="Business identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Address" value={formatStructuredAddress(tenant, metadata)} />
          <DetailField label="Phone" value={displayValue(tenant.phone)} />
          <DetailField label="Email" value={displayValue(tenant.email)} />
          <DetailField label="Tax ID (metadata)" value={displayValue(metadata.taxId)} />
          <DetailField label="Tax number (tenant)" value={displayValue(tenant.taxNumber)} />
          <DetailField
            label="Specialties"
            value={
              metadata.specialties?.length
                ? metadata.specialties.join(", ")
                : NOT_PROVIDED
            }
          />
          <DetailField
            label="Doctor count"
            value={displayValue(metadata.doctorCount)}
          />
          <DetailField
            label="Referral source"
            value={displayValue(metadata.referralSource)}
          />
          <DetailField label="Timezone" value={displayValue(tenant.timezone)} />
          <DetailField label="Locale" value={displayValue(tenant.locale)} />
        </div>
      </DetailSection>

      {/* OWNER */}
      <DetailSection
        title="Owner / primary contact"
        description="Inferred from Owner account — dedicated primary contact fields coming in a future phase."
      >
        {owner ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailField label="Name" value={owner.name} />
            <DetailField label="Email" value={owner.email} />
            <DetailField label="Joined" value={formatDate(owner.joinedAt)} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{NOT_PROVIDED}</p>
        )}
      </DetailSection>

      {/* SUBSCRIPTION & BILLING */}
      <DetailSection title="Subscription & billing">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Plan" value={tenant.subscriptionPlan} />
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Subscription status</p>
            <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Trial ends</p>
            <p className="text-sm">
              {tenant.trialEndsAt ? formatDate(tenant.trialEndsAt) : NOT_PROVIDED}
            </p>
            {tenant.subscriptionStatus === "TRIALING" && trialDays !== null && (
              <p className={`text-xs font-medium ${trialUrgencyClass(trialDays)}`}>
                {trialDays === 0
                  ? "Trial expires today"
                  : `${trialDays} day${trialDays === 1 ? "" : "s"} remaining`}
              </p>
            )}
          </div>
          <DetailField
            label="Current period end"
            value={
              tenant.currentPeriodEnd
                ? formatDate(tenant.currentPeriodEnd)
                : NOT_PROVIDED
            }
          />
          <DetailField
            label="Stripe customer"
            value={tenant.stripeCustomerId ?? "Not connected"}
            mono
          />
          <DetailField
            label="Stripe subscription"
            value={tenant.stripeSubscriptionId ?? "Not connected"}
            mono
          />
          <DetailField
            label="Clinical revenue (payments)"
            value={formatCurrency(totalRevenue)}
          />
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
          <PlanUpgradeForm
            tenantId={tenant.id}
            currentPlan={tenant.subscriptionPlan}
            currentStatus={tenant.subscriptionStatus}
          />
        </div>

        {tenant.stripeCustomerId && (
          <div className="mt-6">
            <h4 className="mb-3 text-sm font-medium text-zinc-300">SaaS billing history</h4>
            {stripeHistoryError ? (
              <p className="text-sm text-amber-400">Unable to load Stripe history</p>
            ) : stripeHistory && stripeHistory.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-zinc-400">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stripeHistory.map((inv) => (
                      <tr key={inv.id} className="border-t border-white/10">
                        <td className="px-4 py-2">
                          {new Date(inv.created * 1000).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          {inv.currency} {inv.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 capitalize">{inv.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No Stripe invoices on file.</p>
            )}
          </div>
        )}
      </DetailSection>

      {/* USAGE & ENTITLEMENTS */}
      <DetailSection
        title="Usage & entitlements"
        description={
          accessBlocked
            ? "Features are currently blocked due to subscription or clinic status."
            : "Effective access reflects plan entitlements and active subscription status."
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <UsageBar
              label="Patients"
              used={usage.patients.used}
              max={usage.patients.max}
              pct={usage.patients.pct}
            />
            <UsageBar
              label="Staff"
              used={usage.staff.used}
              max={usage.staff.max}
              pct={usage.staff.pct}
            />
            <UsageBar
              label="Branches"
              used={usage.branches.used}
              max={usage.branches.max}
              pct={usage.branches.pct}
            />
          </div>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Feature access (effective)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {booleanFeatures.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
                >
                  <span>{f.label}</span>
                  <span className={f.effective ? "text-emerald-400" : "text-zinc-500"}>
                    {f.effective ? "Yes" : "No"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DetailSection>

      {/* BRANCHES */}
      <DetailSection title={`Branches (${branches.length})`}>
        {branches.length === 0 ? (
          <p className="text-sm text-zinc-500">No branches configured.</p>
        ) : (
          <div className="space-y-3">
            {branches.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-3 text-sm last:border-0"
              >
                <div>
                  <span className="font-medium">{b.name}</span>
                  {b.isPrimary && (
                    <Badge className="ml-2" variant="secondary">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="text-right text-zinc-400">
                  <p>{displayValue(b.address)}</p>
                  <p>{displayValue(b.phone)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      {/* LIFECYCLE */}
      <DetailSection title="Lifecycle & status">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Created" value={formatDate(tenant.createdAt)} />
          <DetailField label="Last updated" value={formatDate(tenant.updatedAt)} />
          <DetailField
            label="Onboarding completed"
            value={tenant.onboardingCompleted ? "Yes" : "No"}
          />
          <DetailField label="Clinic status" value={tenant.status} />
          {tenant.status === "SUSPENDED" && (
            <>
              <DetailField
                label="Suspended at"
                value={
                  tenant.suspendedAt ? formatDate(tenant.suspendedAt) : NOT_PROVIDED
                }
              />
              <DetailField
                label="Suspension reason"
                value={displayValue(tenant.suspendedReason)}
              />
            </>
          )}
        </div>
      </DetailSection>

      {/* ACTIVITY */}
      <DetailSection
        title="Recent activity (approximate)"
        description="Dedicated activity tracking coming in a future phase. These are best-effort proxies from audit logs, appointments, and staff records."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <DetailField
            label="Latest audit event"
            value={
              activity.latestAudit
                ? `${activity.latestAudit.action} ${activity.latestAudit.entity} · ${formatDate(activity.latestAudit.createdAt)}`
                : NOT_PROVIDED
            }
          />
          <DetailField
            label="Latest appointment"
            value={
              activity.latestAppointment
                ? `${activity.latestAppointment.title} (${activity.latestAppointment.status}) · ${formatDate(activity.latestAppointment.startTime)}`
                : NOT_PROVIDED
            }
          />
          <DetailField
            label="Most recent staff member"
            value={
              activity.latestStaff
                ? `${activity.latestStaff.name} · ${formatDate(activity.latestStaff.createdAt)}`
                : NOT_PROVIDED
            }
          />
        </div>
      </DetailSection>

      {/* AUDIT LOG */}
      <DetailSection title="Audit log">
        <TenantAuditLogSection
          tenantId={tenant.id}
          logs={auditLogs}
          totalCount={auditTotalCount}
          currentPage={auditPage}
          pageSize={auditPageSize}
        />
      </DetailSection>

      {/* ACTIONS */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="text-lg font-semibold text-destructive">Actions</h3>
        <div className="mt-4 flex flex-wrap gap-2">
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
          <DeleteTenantAccountButton
            tenantId={tenant.id}
            tenantName={tenant.name}
            action={deleteTenantAccountAction}
          />
        </div>
      </section>
    </div>
  );
}
