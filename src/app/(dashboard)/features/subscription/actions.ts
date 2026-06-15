"use server";

import { z } from "zod";
import { SubscriptionPlan, subscriptionPlanSchema } from "@/lib/subscription/plan-types";
import { createAction } from "@/lib/actions/safe-action";
import { ensureStripeCustomer } from "@/lib/tenant/billing";
import {
  createBillingPortalSession,
  createCheckoutSession,
  stripe,
  PLAN_PRICE_IDS,
} from "@/lib/stripe";
import { getTenantMetrics } from "@/lib/tenant/metrics";
import { getUsageLimits } from "@/lib/subscription/plans-display";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function getSubscriptionOverview(tenantId: string) {
  const metrics = await getTenantMetrics(tenantId);
  return metrics;
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
    const session = await createCheckoutSession({
      customerId: tenant.stripeCustomerId ?? undefined,
      customerEmail: tenant.email ?? ctx.user.email,
      plan: input.plan,
      tenantId: tenant.id,
      successUrl: `${appUrl}/billing/subscription?success=1`,
      cancelUrl: `${appUrl}/billing/subscription?canceled=1`,
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

export type StripeInvoiceItem = {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  created: number;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
};

export async function getStripeBillingHistory(
  stripeCustomerId: string | null,
): Promise<StripeInvoiceItem[]> {
  if (!stripeCustomerId || !process.env.STRIPE_SECRET_KEY) return [];

  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 12,
  });

  return invoices.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    amount: inv.amount_paid / 100,
    currency: inv.currency.toUpperCase(),
    status: inv.status,
    created: inv.created,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    pdfUrl: inv.invoice_pdf ?? null,
  }));
}

export async function getSubscriptionUsage(tenantId: string, plan: SubscriptionPlan) {
  const metrics = await getTenantMetrics(tenantId);
  const limits = getUsageLimits(plan);

  return {
    patients: { used: metrics.patients, limit: limits.maxPatients },
    users: { used: metrics.users, limit: limits.maxUsers },
    appointments: metrics.appointments,
    invoices: metrics.invoices,
  };
}
