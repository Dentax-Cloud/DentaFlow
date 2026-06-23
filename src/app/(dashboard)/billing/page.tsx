import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { getInvoices, getProcedureCatalog } from "@/app/(dashboard)/features/billing/actions";
import { serializeDecimal, serializeEntity } from "@/lib/utils/serialize";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const ctx = await requireRouteAccess("billing", "read");
  const [invoices, patients, procedures] = await Promise.all([
    getInvoices(ctx.tenant.id),
    getPatients(ctx.tenant.id),
    getProcedureCatalog(ctx.tenant.id),
  ]);

  const serializedInvoices = invoices.map((invoice) =>
    serializeEntity(invoice, { payments: "array", items: "array", patient: "object" }),
  );

  return (
    <BillingClient
      invoices={serializedInvoices}
      patients={patients}
      procedures={procedures.map(serializeDecimal)}
    />
  );
}
