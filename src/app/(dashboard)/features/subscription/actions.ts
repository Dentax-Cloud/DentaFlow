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
import { getStaffActor } from "@/lib/tenant/context";
import { getTenantUsage } from "@/lib/features/usage";

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
  if (!stripeCustomerId) return [];

  const stripe = await getStripeClient();
  if (!stripe) return [];

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

export async function getSubscriptionUsage(tenantId: string) {
  const [usage, metrics] = await Promise.all([
    getTenantUsage(tenantId),
    getTenantMetrics(tenantId),
  ]);

  return {
    patients: usage.patients,
    users: usage.staff,
    branches: usage.branches,
    appointments: metrics.appointments,
    invoices: metrics.invoices,
  };
}
