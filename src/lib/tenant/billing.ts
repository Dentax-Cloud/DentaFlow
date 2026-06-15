import { db } from "@/lib/db";
import type { Tenant } from "@prisma/client";
import { stripe } from "@/lib/stripe";

/**
 * Ensure Stripe customer exists when tenant becomes ACTIVE.
 */
export async function ensureStripeCustomer(tenant: Tenant): Promise<Tenant> {
  if (tenant.stripeCustomerId || !process.env.STRIPE_SECRET_KEY) {
    return tenant;
  }

  const customer = await stripe.customers.create({
    name: tenant.name,
    metadata: { tenantId: tenant.id, clerkOrgId: tenant.clerkOrgId },
  });

  return db.tenant.update({
    where: { id: tenant.id },
    data: { stripeCustomerId: customer.id },
  });
}
