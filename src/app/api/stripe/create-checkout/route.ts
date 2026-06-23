import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { ensureStripeCustomer } from "@/lib/tenant/billing";
import { createCheckoutSession, PLAN_PRICE_IDS } from "@/lib/stripe";
import { SubscriptionStatus } from "@prisma/client";
import { isSubscriptionPlan } from "@/lib/subscription/plan-types";
import { NextRequest, NextResponse } from "next/server";

const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { plan } = body;
  if (!plan || !isSubscriptionPlan(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (!PLAN_PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Stripe price not configured" }, { status: 400 });
  }

  const ctx = await requireTenantContext();
  const tenant = await ensureStripeCustomer(ctx.tenant);

  const trialEndUnix =
    tenant.trialEndsAt && tenant.subscriptionStatus === SubscriptionStatus.TRIALING
      ? Math.floor(tenant.trialEndsAt.getTime() / 1000)
      : undefined;

  const checkoutSession = await createCheckoutSession({
    customerId: tenant.stripeCustomerId ?? undefined,
    customerEmail: tenant.email ?? session.user.email,
    plan,
    tenantId: tenant.id,
    successUrl: `${appUrl}/billing/subscription?success=true`,
    cancelUrl: `${appUrl}/billing/subscription?canceled=true`,
    trialEndUnix,
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: checkoutSession.url });
}
