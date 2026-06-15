export const runtime = "nodejs";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { SubscriptionStatus } from "@prisma/client";
import { isSubscriptionPlan, SubscriptionPlan } from "@/lib/subscription/plan-types";
import type Stripe from "stripe";

function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "incomplete_expired":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

function planFromMetadata(plan?: string | null): SubscriptionPlan | undefined {
  if (plan && isSubscriptionPlan(plan)) return plan;
  return undefined;
}

/** Extract trial and billing period dates from a Stripe subscription object. */
function subscriptionPeriodDates(sub: Stripe.Subscription) {
  return {
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  };
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const plan = planFromMetadata(session.metadata?.plan);
      if (tenantId) {
        let periodDates: ReturnType<typeof subscriptionPeriodDates> | undefined;
        if (session.subscription && typeof session.subscription === "string") {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          periodDates = subscriptionPeriodDates(sub);
        }

        await db.tenant.update({
          where: { id: tenantId },
          data: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionPlan: plan ?? SubscriptionPlan.PROFESSIONAL,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            ...(periodDates ?? {}),
          },
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      const plan = planFromMetadata(sub.metadata?.plan);
      const periodDates = subscriptionPeriodDates(sub);
      if (tenantId) {
        await db.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionStatus: mapSubscriptionStatus(sub.status),
            ...(plan ? { subscriptionPlan: plan } : {}),
            trialEndsAt: periodDates.trialEndsAt,
            currentPeriodEnd: periodDates.currentPeriodEnd,
            ...(event.type === "customer.subscription.deleted"
              ? { stripeSubscriptionId: null }
              : { stripeSubscriptionId: sub.id }),
          },
        });
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string | null;
      if (customerId) {
        await db.tenant.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
