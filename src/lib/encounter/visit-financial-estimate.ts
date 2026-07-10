import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { calculateInsuranceSplit } from "@/lib/billing/insurance-calculator";
import { calculateInvoiceTaxAndLines } from "@/lib/billing/calculate-invoice-tax";
import {
  extractProcedureCodesFromInvoiceItems,
  mapProcedureLinesToInvoiceItems,
  type ProcedureLineBillable,
} from "@/lib/billing/procedure-line-invoice";
import { formatCurrency } from "@/lib/countries";

export type VisitFinancialEstimate = {
  total: number;
  insuranceAmount: number;
  patientAmount: number;
  currency: string;
  lineCount: number;
};

export function buildVisitFinancialEstimateSummary(
  estimate: VisitFinancialEstimate,
  countryCode: string,
): string {
  const money = (amount: number) => formatCurrency(amount, countryCode);
  return [
    `Visit complete. Estimated total: ${money(estimate.total)} (${money(estimate.insuranceAmount)} insurance, ${money(estimate.patientAmount)} patient responsibility).`,
    "This is an estimate for checkout — not a final invoice. Generate the invoice from Ready to Invoice when billing is ready.",
  ].join(" ");
}

export async function computeVisitFinancialEstimate(params: {
  tenantId: string;
  patientId: string;
  appointmentId: string;
}): Promise<VisitFinancialEstimate | null> {
  const rawLines = await db.procedureLine.findMany({
    where: {
      tenantId: params.tenantId,
      appointmentId: params.appointmentId,
      status: "CLOSED",
    },
    orderBy: { createdAt: "asc" },
  });

  if (rawLines.length === 0) return null;

  const billable: ProcedureLineBillable[] = rawLines.map((line) => {
    const serialized = serializeDecimal(line);
    return {
      id: line.id,
      ownerType: line.ownerType,
      ownerId: line.ownerId,
      status: line.status,
      procedureCode: line.procedureCode,
      procedureName: line.procedureName,
      unitPrice: Number(serialized.unitPrice ?? 0),
      quantity: line.quantity,
      itemType: line.ownerType === "STORE" ? "GOOD" : "SERVICE",
    };
  });

  const items = mapProcedureLinesToInvoiceItems(billable);
  const taxResult = await calculateInvoiceTaxAndLines({
    tenantId: params.tenantId,
    patientId: params.patientId,
    items: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      procedureCode: item.procedureCode,
      inventoryItemId: item.inventoryItemId,
      itemType: item.itemType,
      gstRatePercent: item.gstRatePercent,
      hsnCode: item.hsnCode,
    })),
  });

  const insuranceSplit = await calculateInsuranceSplit({
    tenantId: params.tenantId,
    patientId: params.patientId,
    procedureCodes: extractProcedureCodesFromInvoiceItems(items),
    totalAmount: taxResult.total,
  });

  return {
    total: taxResult.total,
    insuranceAmount: insuranceSplit?.insurerAmount ?? 0,
    patientAmount: insuranceSplit?.patientAmount ?? taxResult.total,
    currency: taxResult.currency,
    lineCount: billable.length,
  };
}
