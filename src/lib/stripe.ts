import Stripe from "stripe";
import { InvoiceStatus, PaymentMethod, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  isSubscriptionPlan,
  SubscriptionPlan,
  type SubscriptionPlan as SubscriptionPlanType,
} from "@/lib/subscription/plan-types";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export const PLAN_PRICE_IDS: Record<SubscriptionPlanType, string | undefined> = {
  STARTER: process.env.STRIPE_PRICE_STARTER,
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
};

export async function createCheckoutSession(params: {
  customerId?: string;
  customerEmail?: string;
  plan: SubscriptionPlanType;
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

function planFromMetadata(plan?: string | null): SubscriptionPlanType | undefined {
  if (plan && isSubscriptionPlan(plan)) return plan;
  return undefined;
}

function extractPlanFromSubscription(sub: Stripe.Subscription): SubscriptionPlanType {
  const priceId = sub.items.data[0]?.price?.id;
  if (!priceId) return SubscriptionPlan.STARTER;

  for (const [plan, configuredPriceId] of Object.entries(PLAN_PRICE_IDS) as [
    SubscriptionPlanType,
    string | undefined,
  ][]) {
    if (configuredPriceId && configuredPriceId === priceId) return plan;
  }

  return planFromMetadata(sub.metadata?.plan) ?? SubscriptionPlan.STARTER;
}

function subscriptionPeriodDates(sub: Stripe.Subscription) {
  return {
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  };
}

async function resolveTenantForSubscription(sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenantId;
  if (tenantId) {
    return db.tenant.findUnique({ where: { id: tenantId } });
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  return db.tenant.findFirst({ where: { stripeCustomerId: customerId } });
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const tenant = await resolveTenantForSubscription(sub);
  if (!tenant) {
    console.warn("[stripe] no tenant for subscription:", sub.id);
    return;
  }

  const plan = planFromMetadata(sub.metadata?.plan) ?? extractPlanFromSubscription(sub);
  const periodDates = subscriptionPeriodDates(sub);

  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: mapSubscriptionStatus(sub.status),
      subscriptionPlan: plan,
      stripeSubscriptionId: sub.id,
      stripeCustomerId:
        typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? tenant.stripeCustomerId),
      trialEndsAt: periodDates.trialEndsAt,
      currentPeriodEnd: periodDates.currentPeriodEnd,
    },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const tenant = await resolveTenantForSubscription(sub);
  if (!tenant) return;

  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: SubscriptionStatus.CANCELED,
      stripeSubscriptionId: null,
    },
  });
}

async function handleSaasInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  await db.tenant.updateMany({
    where: { stripeCustomerId: customerId },
    data: { subscriptionStatus: SubscriptionStatus.ACTIVE },
  });
}

async function handleSaasInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  await db.tenant.updateMany({
    where: { stripeCustomerId: customerId },
    data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
  });
}

function isClinicInvoiceMetadata(metadata: Stripe.Metadata | null | undefined) {
  if (!metadata?.tenantId || !metadata.invoiceId) return false;
  if (metadata.type === "clinic_invoice") return true;
  return metadata.type !== "saas_subscription" && !metadata.plan;
}

async function markClinicInvoicePaid(params: {
  tenantId: string;
  invoiceId: string;
  paymentIntentId: string;
  amountCents: number | null;
}) {
  const invoice = await db.invoice.findFirst({
    where: {
      id: params.invoiceId,
      tenantId: params.tenantId,
      deletedAt: null,
    },
    include: { payments: true },
  });

  if (!invoice || invoice.status === InvoiceStatus.PAID) return;

  if (invoice.payments.some((p) => p.stripePaymentId === params.paymentIntentId)) {
    return;
  }

  const amount =
    params.amountCents !== null ? params.amountCents / 100 : Number(invoice.total);

  await db.$transaction([
    db.payment.create({
      data: {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        amount,
        method: PaymentMethod.STRIPE,
        stripePaymentId: params.paymentIntentId,
        reference: params.paymentIntentId,
      },
    }),
    db.invoice.update({
      where: { id: params.invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        stripePaymentIntentId: params.paymentIntentId,
      },
    }),
  ]);
}

async function handleClinicCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { tenantId, invoiceId } = session.metadata ?? {};
  if (!tenantId || !invoiceId || !isClinicInvoiceMetadata(session.metadata)) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn("[stripe] clinic checkout missing payment_intent:", session.id);
    return;
  }

  await markClinicInvoicePaid({
    tenantId,
    invoiceId,
    paymentIntentId,
    amountCents: session.amount_total,
  });
}

async function handleClinicPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { tenantId, invoiceId } = paymentIntent.metadata ?? {};
  if (!tenantId || !invoiceId) return;

  await markClinicInvoicePaid({
    tenantId,
    invoiceId,
    paymentIntentId: paymentIntent.id,
    amountCents: paymentIntent.amount_received ?? paymentIntent.amount,
  });
}

async function handleSaasCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenantId;
  const plan = planFromMetadata(session.metadata?.plan);
  if (!tenantId || session.mode !== "subscription") return;

  let periodDates: ReturnType<typeof subscriptionPeriodDates> | undefined;
  if (session.subscription && typeof session.subscription === "string") {
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    periodDates = subscriptionPeriodDates(sub);
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? undefined;

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
      subscriptionPlan: plan ?? SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      ...(periodDates ?? {}),
    },
  });
}

export async function createCheckoutSessionForTenant(
  tenantId: string,
  plan: SubscriptionPlanType,
  successUrl: string,
  cancelUrl: string,
  customerEmail?: string,
) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  return createCheckoutSession({
    customerId: tenant.stripeCustomerId ?? undefined,
    customerEmail: tenant.stripeCustomerId ? undefined : customerEmail,
    plan,
    tenantId,
    successUrl,
    cancelUrl,
  });
}

export async function updateTenantFromWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (isClinicInvoiceMetadata(session.metadata)) {
        await handleClinicCheckoutCompleted(session);
      } else {
        await handleSaasCheckoutCompleted(session);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.payment_succeeded": {
      await handleSaasInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    }
    case "invoice.payment_failed": {
      await handleSaasInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    }
    case "payment_intent.succeeded": {
      await handleClinicPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    }
    default:
      break;
  }
}
