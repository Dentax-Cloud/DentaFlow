import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { ensureStripeCustomer } from "@/lib/tenant/billing";
import { createBillingPortalSession } from "@/lib/stripe";
import { NextResponse } from "next/server";

const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await requireTenantContext();
  const tenant = await ensureStripeCustomer(ctx.tenant);

  if (!tenant.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 });
  }

  const portalSession = await createBillingPortalSession(
    tenant.stripeCustomerId,
    `${appUrl}/billing/subscription`,
  );

  return NextResponse.json({ url: portalSession.url });
}
