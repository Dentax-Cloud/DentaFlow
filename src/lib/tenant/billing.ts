import { db } from "@/lib/db";
import type { Tenant } from "@prisma/client";
import { getStripeClient } from "@/lib/stripe";

async function isStripeConfigured(): Promise<boolean> {
  const client = await getStripeClient();
  return client !== null;
}

/**
 * Ensure Stripe customer exists for billing (registration + checkout).
 */
export async function ensureStripeCustomer(tenant: Tenant): Promise<Tenant> {
  if (tenant.stripeCustomerId || !(await isStripeConfigured())) {
    return tenant;
  }

  try {
    const stripe = await getStripeClient();
    if (!stripe) return tenant;

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
