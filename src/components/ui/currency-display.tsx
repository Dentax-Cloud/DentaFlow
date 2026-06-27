"use client";

import { formatCurrency } from "@/lib/countries";

type Props = {
  amount: number;
  currency?: string;
  countryCode?: string;
  className?: string;
};

export function CurrencyDisplay({
  amount,
  countryCode = "AE",
  className,
}: Props) {
  return <span className={className}>{formatCurrency(amount, countryCode)}</span>;
}
