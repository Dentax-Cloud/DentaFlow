import { getStripeClient } from "@/lib/stripe";
import type { StripeInvoiceItem } from "@/app/(dashboard)/features/subscription/subscription-types";

/** Non-action helper — safe for super-admin RSC pages; not a "use server" export. */
export async function listStripeInvoicesForCustomer(
  stripeCustomerId: string | null | undefined,
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
