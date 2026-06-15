import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { getInvoices, getProcedureCatalog } from "@/app/(dashboard)/features/billing/actions";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const ctx = await requireRouteAccess("billing", "read");
  const [invoices, patients, procedures] = await Promise.all([
    getInvoices(ctx.tenant.id),
    getPatients(ctx.tenant.id),
    getProcedureCatalog(ctx.tenant.id),
  ]);

  return <BillingClient invoices={invoices} patients={patients} procedures={procedures} />;
}
