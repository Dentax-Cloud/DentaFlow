import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { SubscriptionPage } from "@/components/subscription/subscription-page";
import {
  getStripeBillingHistory,
  getSubscriptionUsage,
} from "@/app/(dashboard)/features/subscription/actions";
import { getPublicSubscriptionPlans } from "@/lib/subscription/plans-display";

export default async function SubscriptionManagementPage() {
  const ctx = await requireRouteAccess("admin", "read");
  const [usage, billingHistory, plans] = await Promise.all([
    getSubscriptionUsage(),
    getStripeBillingHistory(),
    getPublicSubscriptionPlans(),
  ]);

  return (
    <SubscriptionPage
      plans={plans}
      tenant={{
        id: ctx.tenant.id,
        name: ctx.tenant.name,
        subscriptionPlan: ctx.tenant.subscriptionPlan,
        subscriptionStatus: ctx.tenant.subscriptionStatus,
        stripeCustomerId: ctx.tenant.stripeCustomerId,
        trialEndsAt: ctx.tenant.trialEndsAt,
        currentPeriodEnd: ctx.tenant.currentPeriodEnd,
      }}
      usage={usage}
      billingHistory={billingHistory}
    />
  );
}
