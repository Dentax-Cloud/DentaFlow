"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { setPricingCountryOverride } from "@/lib/geo/pricing-country-actions";
import type { CountryProfile } from "@/lib/countries";

type Props = {
  countries: CountryProfile[];
  currentCountry: string;
  isOverride: boolean;
};

/**
 * Lets a visitor override the auto-detected (IP-based) pricing currency. The detection itself
 * stays silent and automatic — this is only shown as a small, low-emphasis control so visitors
 * who want a different currency than the one we guessed can pick one explicitly.
 */
export function PricingCurrencySelect({ countries, currentCountry, isOverride }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentCountry);
  const selectRef = useRef<HTMLSelectElement>(null);

  function handleChange(code: string) {
    setSelected(code);
    startTransition(async () => {
      await setPricingCountryOverride(code);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-400">
      <Globe className="h-4 w-4 text-zinc-500" />
      <span>Prices shown in</span>
      <select
        ref={selectRef}
        value={selected}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "rounded-lg border border-white/10 bg-zinc-900/80 px-2.5 py-1 text-sm text-white",
          "focus:outline-none focus:ring-1 focus:ring-sky-500/50",
          isPending && "opacity-60",
        )}
      >
        {countries.map((country) => (
          <option key={country.code} value={country.code} className="bg-zinc-900">
            {country.flag} {country.currency} — {country.name}
          </option>
        ))}
      </select>
      {isOverride && <span className="text-xs text-zinc-500">(your choice)</span>}
    </div>
  );
}
