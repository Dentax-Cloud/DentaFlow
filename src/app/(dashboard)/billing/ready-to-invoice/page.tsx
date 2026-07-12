import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getBillingQueue } from "@/app/(dashboard)/features/billing/ready-to-invoice-actions";
import { ReadyToInvoiceClient } from "./ready-to-invoice-client";

export const runtime = "nodejs";

export default async function ReadyToInvoicePage() {
  const ctx = await requireRouteAccess("billing", "read");
  const queue = await getBillingQueue();

  return (
    <ReadyToInvoiceClient
      queue={queue}
      countryCode={ctx.tenant.countryCode}
      staffRole={ctx.staffMember?.role}
    />
  );
}
