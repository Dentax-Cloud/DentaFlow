"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Shield, Zap, ArrowUpRight } from "lucide-react";
import type { SubscriptionStatus, Tenant } from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingCard } from "./pricing-card";
import { FeatureComparisonTable } from "./feature-comparison-table";
import { UsageMetrics } from "./usage-metrics";
import { BillingHistory } from "./billing-history";
import { PLAN_DISPLAY, getPlanDisplay } from "@/lib/subscription/plans-display";
import {
  createSubscriptionCheckoutAction,
  openBillingPortalAction,
  type StripeInvoiceItem,
} from "@/app/(dashboard)/features/subscription/actions";

type Usage = {
  patients: { used: number; limit: number };
  users: { used: number; limit: number };
  appointments: number;
  invoices: number;
};

type Props = {
  tenant: Pick<
    Tenant,
    "id" | "name" | "subscriptionPlan" | "subscriptionStatus" | "stripeCustomerId"
  >;
  plans: typeof PLAN_DISPLAY;
  usage: Usage;
  billingHistory: StripeInvoiceItem[];
};

const statusVariant: Record<SubscriptionStatus, "success" | "warning" | "destructive" | "outline"> = {
  ACTIVE: "success",
  TRIALING: "outline",
  EXPIRED: "destructive",
  PAST_DUE: "warning",
  CANCELED: "destructive",
  INCOMPLETE: "warning",
};

export function SubscriptionPage({ tenant, plans, usage, billingHistory }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const current = getPlanDisplay(tenant.subscriptionPlan);

  async function handleSelectPlan(plan: SubscriptionPlan) {
    if (plan === SubscriptionPlan.ENTERPRISE) {
      window.location.href = "mailto:sales@dentaflow.app?subject=Enterprise%20Plan%20Inquiry";
      return;
    }
    setLoadingPlan(plan);
    const result = await createSubscriptionCheckoutAction({ plan });
    setLoadingPlan(null);
    if (result.success) {
      window.location.href = result.data.url;
    } else {
      toast.error(result.error);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    const result = await openBillingPortalAction({});
    setPortalLoading(false);
    if (result.success) {
      window.location.href = result.data.url;
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-sky-50 p-8 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/40">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-dental/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Zap className="h-3 w-3 text-dental" />
              Subscription
            </Badge>
            <Badge variant={statusVariant[tenant.subscriptionStatus]}>
              {tenant.subscriptionStatus}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
            Plans built for modern dental practices
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {tenant.name} is on the <strong>{current.name}</strong> plan. Upgrade to unlock AI
            clinical tools, patient portal, and advanced odontogram charting.
          </p>
          <div className="flex flex-wrap gap-3">
            {tenant.stripeCustomerId && (
              <Button variant="outline" disabled={portalLoading} onClick={handleManageBilling}>
                <CreditCard className="h-4 w-4" />
                Manage billing
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" asChild>
              <a href="mailto:support@dentaflow.app">Contact support</a>
            </Button>
          </div>
        </div>
      </div>

      <UsageMetrics usage={usage} />

      {/* Pricing cards */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Choose your plan</h2>
          <p className="text-sm text-muted-foreground">
            Transparent pricing. Upgrade or downgrade anytime via Stripe.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              currentPlan={tenant.subscriptionPlan}
              loading={loadingPlan === plan.id}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>
      </div>

      <Tabs defaultValue="compare">
        <TabsList>
          <TabsTrigger value="compare">Feature comparison</TabsTrigger>
          <TabsTrigger value="billing">Billing history</TabsTrigger>
        </TabsList>
        <TabsContent value="compare">
          <FeatureComparisonTable />
        </TabsContent>
        <TabsContent value="billing" className="space-y-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-dental" />
                Secure billing via Stripe
              </CardTitle>
              <CardDescription>
                View past invoices or cancel your subscription from the Stripe billing portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenant.stripeCustomerId ? (
                <Button variant="outline" disabled={portalLoading} onClick={handleManageBilling}>
                  Open billing portal
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete a plan upgrade to set up billing.
                </p>
              )}
            </CardContent>
          </Card>
          <BillingHistory invoices={billingHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
