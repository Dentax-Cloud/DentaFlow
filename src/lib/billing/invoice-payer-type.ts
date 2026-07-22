import type { InvoicePayerType } from "@prisma/client";
import type { InsuranceCalculation } from "@/lib/billing/insurance-calculator";

/**
 * Derive reporting payer-type from calculateInsuranceSplit output.
 * - null split → SELF_PAY
 * - insurer > 0 and patient ≈ 0 → INSURANCE (fully covered)
 * - insurer > 0 and patient > 0 → CO_PAY
 * - otherwise → SELF_PAY
 */
export function resolveInvoicePayerType(
  split: InsuranceCalculation | null | undefined,
): InvoicePayerType {
  if (!split) return "SELF_PAY";

  const insurer = Number(split.insurerAmount ?? 0);
  const patient = Number(split.patientAmount ?? 0);

  if (insurer > 0 && patient <= 0.000_001) return "INSURANCE";
  if (insurer > 0 && patient > 0) return "CO_PAY";
  return "SELF_PAY";
}

export function invoicePayerTypeLabel(payerType: InvoicePayerType | string | null | undefined): string {
  switch (payerType) {
    case "SELF_PAY":
      return "Self-pay";
    case "INSURANCE":
      return "Insurance";
    case "CO_PAY":
      return "Co-pay";
    default:
      return "Self-pay";
  }
}
