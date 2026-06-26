export const runtime = "nodejs";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripeClient, getStripeWebhookSecret, updateTenantFromWebhook } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = await getStripeWebhookSecret();

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = await getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await updateTenantFromWebhook(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err, { type: event.type });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
