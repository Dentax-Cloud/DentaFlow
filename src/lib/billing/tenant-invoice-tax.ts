import { db } from "@/lib/db";

export type TenantInvoiceTax = {
  currency: string;
  taxName: string;
  taxNumber: string | null;
  taxRatePercent: number;
  taxRateDecimal: number;
};

export async function getTenantInvoiceTax(tenantId: string): Promise<TenantInvoiceTax> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      currency: true,
      taxName: true,
      taxRate: true,
      taxNumber: true,
      taxOnDental: true,
    },
  });

  const taxRatePercent = tenant?.taxOnDental ? Number(tenant.taxRate ?? 0) : 0;

  return {
    currency: tenant?.currency ?? "AED",
    taxName: tenant?.taxName ?? "VAT",
    taxNumber: tenant?.taxNumber ?? null,
    taxRatePercent,
    taxRateDecimal: taxRatePercent / 100,
  };
}
