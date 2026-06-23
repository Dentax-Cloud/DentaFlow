"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Shield, Zap, ArrowUpRight, AlertTriangle, CalendarDays } from "lucide-react";
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
import { getTrialDaysRemaining } from "@/lib/tenant/trial";
import {
  createSubscriptionCheckoutAction,
  openBillingPortalAction,
  type StripeInvoiceItem,
} from "@/app/(dashboard)/features/subscription/actions";

type UsageMetric = { used: number; max: number; pct: number };

type Usage = {
  patients: UsageMetric;
  users: UsageMetric;
  branches: UsageMetric;
  appointments: number;
  invoices: number;
};

type Props = {
  tenant: {
    id: string;
    name: string;
    subscriptionPlan: Tenant["subscriptionPlan"];
    subscriptionStatus: SubscriptionStatus;
    stripeCustomerId: string | null;
    trialEndsAt: Date | string | null;
    currentPeriodEnd: Date | string | null;
  };
  plans: typeof PLAN_DISPLAY;
  usage: Usage;
  billingHistory: StripeInvoiceItem[];
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

const statusVariant: Record<
  SubscriptionStatus,
  "success" | "warning" | "destructive" | "outline"
> = {
  ACTIVE: "success",
  TRIALING: "outline",
  EXPIRED: "destructive",
  PAST_DUE: "warning",
  CANCELED: "destructive",
  INCOMPLETE: "warning",
  PAUSED: "warning",
};

function trialUrgencyClass(days: number): string {
  if (days <= 1) return "text-red-600";
  if (days <= 3) return "text-orange-600";
  return "text-emerald-600";
}

export function SubscriptionPage({ tenant, plans, usage, billingHistory }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const current = getPlanDisplay(tenant.subscriptionPlan);
  const trialEndsAt = asDate(tenant.trialEndsAt);
  const currentPeriodEnd = asDate(tenant.currentPeriodEnd);
  const trialDays =
    tenant.subscriptionStatus === "TRIALING" ? getTrialDaysRemaining(trialEndsAt) : null;

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
      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">{current.name} plan</CardTitle>
            <Badge variant={statusVariant[tenant.subscriptionStatus]}>
              {tenant.subscriptionStatus.replace("_", " ")}
            </Badge>
          </div>
          <CardDescription>{current.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenant.subscriptionStatus === "TRIALING" && trialDays !== null && (
            <p className={`text-sm font-medium ${trialUrgencyClass(trialDays)}`}>
              {trialDays === 0
                ? "Your trial expires today."
                : `${trialDays} day${trialDays === 1 ? "" : "s"} left in your trial.`}
              {tenant.trialEndsAt && trialEndsAt && (
                <span className="ml-1 text-muted-foreground">
                  (ends {trialEndsAt.toLocaleDateString()})
                </span>
              )}
            </p>
          )}

          {tenant.subscriptionStatus === "EXPIRED" && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-200">Trial expired</p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Upgrade to restore access to your clinic data.
                </p>
              </div>
              <Button onClick={() => handleSelectPlan(SubscriptionPlan.STARTER)}>
                Upgrade now
              </Button>
            </div>
          )}

          {tenant.subscriptionStatus === "PAST_DUE" && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">Payment failed</p>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Update your payment method to avoid service interruption.
                </p>
              </div>
              <Button variant="outline" disabled={portalLoading} onClick={handleManageBilling}>
                Update payment method
              </Button>
            </div>
          )}

          {tenant.subscriptionStatus === "ACTIVE" && (
            <div className="flex flex-wrap gap-6 text-sm">
              {currentPeriodEnd && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Next billing:{" "}
                    <strong>{currentPeriodEnd.toLocaleDateString()}</strong>
                  </span>
                </div>
              )}
              <div>
                Amount: <strong>{current.priceLabel}/mo</strong>
              </div>
            </div>
          )}

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
        </CardContent>
      </Card>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-sky-50 p-8 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/40">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-dental/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Zap className="h-3 w-3 text-dental" />
              Subscription
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
            Plans built for modern dental practices
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {tenant.name} is on the <strong>{current.name}</strong> plan. Upgrade to unlock AI
            clinical tools, patient portal, and advanced odontogram charting.
          </p>
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
