import Stripe from "stripe";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
});

export const PLAN_PRICE_IDS: Record<SubscriptionPlan, string | undefined> = {
  STARTER: process.env.STRIPE_PRICE_STARTER,
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
};

export async function createCheckoutSession(params: {
  customerId?: string;
  customerEmail?: string;
  plan: SubscriptionPlan;
  tenantId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const priceId = PLAN_PRICE_IDS[params.plan];
  if (!priceId) throw new Error("Price not configured");

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    customer_email: params.customerId ? undefined : params.customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { tenantId: params.tenantId, plan: params.plan },
    subscription_data: {
      metadata: { tenantId: params.tenantId, plan: params.plan },
    },
  });
}

export async function createBillingPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
