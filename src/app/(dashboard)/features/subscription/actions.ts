"use server";

import { z } from "zod";
import { SubscriptionPlan, subscriptionPlanSchema } from "@/lib/subscription/plan-types";
import { SubscriptionStatus } from "@prisma/client";
import { createAction } from "@/lib/actions/safe-action";
import { ensureStripeCustomer } from "@/lib/tenant/billing";
import {
  createBillingPortalSession,
  createCheckoutSession,
  getStripeClient,
  PLAN_PRICE_IDS,
} from "@/lib/stripe";
import { getUsageSummary } from "@/lib/features/gate";
import { getTenantMetrics } from "@/lib/tenant/metrics";
import { getStaffActor, requireTenantContext } from "@/lib/tenant/context";
import { getTenantUsage } from "@/lib/features/usage";
import { listStripeInvoicesForCustomer } from "@/lib/stripe/billing-history";
import type { StripeInvoiceItem } from "./subscription-types";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function getSubscriptionOverview() {
  const ctx = await requireTenantContext();
  return getTenantMetrics(ctx.tenantId);
}

export const createSubscriptionCheckoutAction = createAction({
  schema: z.object({ plan: subscriptionPlanSchema }),
  handler: async (input, ctx) => {
    if (input.plan === SubscriptionPlan.ENTERPRISE) {
      throw new Error("Contact sales for Enterprise plans");
    }
    if (!PLAN_PRICE_IDS[input.plan]) {
      throw new Error("Stripe price not configured for this plan");
    }

    const tenant = await ensureStripeCustomer(ctx.tenant);

    const trialEndUnix =
      tenant.trialEndsAt && tenant.subscriptionStatus === SubscriptionStatus.TRIALING
        ? Math.floor(tenant.trialEndsAt.getTime() / 1000)
        : undefined;

    const session = await createCheckoutSession({
      customerId: tenant.stripeCustomerId ?? undefined,
      customerEmail: tenant.email ?? getStaffActor(ctx).email,
      plan: input.plan,
      tenantId: tenant.id,
      successUrl: `${appUrl}/billing/subscription?success=1`,
      cancelUrl: `${appUrl}/billing/subscription?canceled=1`,
      trialEndUnix,
    });

    if (!session.url) throw new Error("Could not create checkout session");
    return { url: session.url };
  },
});

export const openBillingPortalAction = createAction({
  schema: z.object({}),
  handler: async (_input, ctx) => {
    const tenant = await ensureStripeCustomer(ctx.tenant);
    if (!tenant.stripeCustomerId) {
      throw new Error("No billing account found");
    }
    const session = await createBillingPortalSession(
      tenant.stripeCustomerId,
      `${appUrl}/billing/subscription`,
    );
    return { url: session.url };
  },
});

/** Session-scoped only — never accepts a client-supplied Stripe customer id. */
export async function getStripeBillingHistory(): Promise<StripeInvoiceItem[]> {
  const ctx = await requireTenantContext();
  return listStripeInvoicesForCustomer(ctx.tenant.stripeCustomerId);
}

export async function getSubscriptionUsage() {
  const ctx = await requireTenantContext();
  const [usage, metrics] = await Promise.all([
    getTenantUsage(ctx.tenantId),
    getTenantMetrics(ctx.tenantId),
  ]);

  return {
    patients: usage.patients,
    users: usage.staff,
    branches: usage.branches,
    appointments: metrics.appointments,
    invoices: metrics.invoices,
  };
}
