import { db } from "@/lib/db";
import type { Tenant } from "@prisma/client";
import { stripe } from "@/lib/stripe";

function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && !key.startsWith("sk_test_dummy"));
}

/**
 * Ensure Stripe customer exists for billing (registration + checkout).
 */
export async function ensureStripeCustomer(tenant: Tenant): Promise<Tenant> {
  if (tenant.stripeCustomerId || !isStripeConfigured()) {
    return tenant;
  }

  try {
    const customer = await stripe.customers.create({
      email: tenant.email ?? undefined,
      name: tenant.name,
      metadata: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        ...(tenant.clerkOrgId ? { clerkOrgId: tenant.clerkOrgId } : {}),
      },
    });

    return db.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customer.id },
    });
  } catch (err) {
    console.warn("[stripe] customer creation failed:", err);
    return tenant;
  }
}
