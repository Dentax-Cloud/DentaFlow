import type { Prisma } from "@prisma/client";

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

/**
 * Pure gate shared by invoice generation + unit tests.
 * Bundled (isBillable=false) materials still deduct stock / audit, but never
 * become separate GOOD invoice lines.
 */
export function isMaterialUsageBillableOnInvoice(usage: {
  isBillable: boolean;
  quantity: Prisma.Decimal | number;
  unitCost: Prisma.Decimal | number;
}): boolean {
  if (!usage.isBillable) return false;
  const qty = decimalToNumber(usage.quantity);
  const cost = decimalToNumber(usage.unitCost);
  return Math.round(qty * cost * 100) / 100 > 0;
}
