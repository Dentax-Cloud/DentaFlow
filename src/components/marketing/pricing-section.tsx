import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanDisplay } from "@/lib/subscription/plans-display";
import type { CountryProfile } from "@/lib/countries";
import { PricingCurrencySelect } from "@/components/marketing/pricing-currency-select";

type Props = {
  plans: PlanDisplay[];
  countries: CountryProfile[];
  currentCountry: string;
  isOverride: boolean;
};

export function PricingSection({ plans, countries, currentCountry, isOverride }: Props) {
  return (
    <section id="pricing" className="border-y border-white/5 bg-zinc-900/20 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 border-white/10 text-zinc-400">
            Simple, transparent pricing
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Plans that scale with your clinic
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Start with a 14-day free trial on Starter. Upgrade anytime as your team and patient
            volume grow.
          </p>
          <PricingCurrencySelect
            countries={countries}
            currentCountry={currentCountry}
            isOverride={isOverride}
          />
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isEnterprise = plan.id === SubscriptionPlan.ENTERPRISE;
            const ctaHref = isEnterprise
              ? "mailto:sales@dentaflow.app?subject=Enterprise%20Plan%20Inquiry"
              : "/sign-up";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-zinc-900/50 p-8 transition-colors",
                  plan.popular
                    ? "border-sky-500/40 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/20"
                    : "border-white/8 hover:border-white/15",
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1 border-sky-500/30 bg-sky-500/15 px-3 text-sky-300">
                      <Sparkles className="h-3 w-3" />
                      Most popular
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>
                  <div className="mt-5">
                    {isEnterprise ? (
                      <span className="text-4xl font-bold tracking-tight text-white">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold tracking-tight text-white">
                          {plan.priceLabel}
                        </span>
                        <span className="text-zinc-500"> /month</span>
                      </>
                    )}
                  </div>
                  {!isEnterprise && (
                    <p className="mt-2 text-xs text-zinc-500">
                      14-day free trial · No credit card required
                    </p>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "h-11 w-full rounded-xl",
                    plan.popular
                      ? "bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold text-white hover:from-sky-500 hover:to-cyan-400"
                      : "border-white/15 bg-white/5 text-white hover:bg-white/10",
                  )}
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link href={ctaHref}>
                    {isEnterprise ? "Contact sales" : plan.cta}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-zinc-500">
          All plans include secure multi-tenant isolation, regular updates, and email support.
          Enterprise pricing is tailored to your organization.
        </p>
      </div>
    </section>
  );
}
