import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { PLAN_FEATURES } from "@/lib/features/plans";
import {
  DEFAULT_PRICING_COUNTRY,
  formatPlanPriceLabel,
  getPlanPricingConfig,
} from "@/lib/subscription/plan-pricing";
import { getCurrency } from "@/lib/countries";

export type PlanDisplay = {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceLabel: string;
  currency: string;
  popular?: boolean;
  cta: string;
  features: string[];
};

export const PLAN_DISPLAY: PlanDisplay[] = [
  {
    id: SubscriptionPlan.STARTER,
    name: "Starter",
    tagline: "Single-chair clinics getting started",
    priceMonthly: 179,
    priceLabel: "AED 179",
    currency: "AED",
    cta: "Start with Starter",
    features: [
      "Up to 500 patients",
      "3 team members",
      "Appointment scheduling",
      "Patient records & billing",
      "Inventory management",
      "Basic reports",
    ],
  },
  {
    id: SubscriptionPlan.PROFESSIONAL,
    name: "Professional",
    tagline: "Growing practices that need AI & automation",
    priceMonthly: 549,
    priceLabel: "AED 549",
    currency: "AED",
    popular: true,
    cta: "Upgrade to Professional",
    features: [
      "Up to 5,000 patients",
      "15 team members",
      "Interactive Odontogram",
      "AI clinical notes & insights",
      "Patient portal",
      "CRM & campaigns",
      "Multi-branch support",
    ],
  },
  {
    id: SubscriptionPlan.ENTERPRISE,
    name: "Enterprise",
    tagline: "DSOs & multi-location groups",
    priceMonthly: 0,
    priceLabel: "Custom",
    currency: "AED",
    cta: "Contact sales",
    features: [
      "Unlimited patients & users",
      "Dedicated success manager",
      "Custom integrations",
      "SLA & priority support",
      "Advanced analytics",
      "SSO & compliance tooling",
      "White-label options",
    ],
  },
];

export type ComparisonRow = {
  feature: string;
  category: string;
  starter: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
};

export const FEATURE_COMPARISON: ComparisonRow[] = [
  { category: "Core", feature: "Patient management", starter: true, professional: true, enterprise: true },
  { category: "Core", feature: "Appointment calendar", starter: true, professional: true, enterprise: true },
  { category: "Clinical", feature: "Interactive Odontogram (FDI)", starter: false, professional: true, enterprise: true },
  { category: "Clinical", feature: "Tooth condition charting", starter: "Basic", professional: true, enterprise: true },
  { category: "Clinical", feature: "Treatment planning", starter: true, professional: true, enterprise: true },
  { category: "Clinical", feature: "Clinical notes (SOAP)", starter: true, professional: true, enterprise: true },
  { category: "AI", feature: "AI clinical note generation", starter: false, professional: true, enterprise: true },
  { category: "AI", feature: "Churn & no-show prediction", starter: false, professional: true, enterprise: true },
  { category: "AI", feature: "AI treatment suggestions", starter: false, professional: true, enterprise: true },
  { category: "Patient", feature: "Patient portal", starter: false, professional: true, enterprise: true },
  { category: "Patient", feature: "Online appointment booking", starter: false, professional: true, enterprise: true },
  { category: "Billing", feature: "Invoicing & payments", starter: true, professional: true, enterprise: true },
  { category: "Billing", feature: "Stripe payment links", starter: true, professional: true, enterprise: true },
  { category: "Billing", feature: "Insurance claims", starter: false, professional: true, enterprise: true },
  { category: "Operations", feature: "Inventory & stock", starter: true, professional: true, enterprise: true },
  { category: "Operations", feature: "CRM & marketing campaigns", starter: false, professional: true, enterprise: true },
  { category: "Operations", feature: "Multi-branch", starter: false, professional: true, enterprise: true },
  { category: "Limits", feature: "Max patients", starter: "500", professional: "5,000", enterprise: "Unlimited" },
  { category: "Limits", feature: "Team members", starter: "3", professional: "15", enterprise: "Unlimited" },
];

/**
 * Public plan cards, priced for one country/currency. Defaults to
 * DEFAULT_PRICING_COUNTRY (AE) when no country is given, matching this
 * function's pre-existing single-currency behavior exactly — the billing
 * page call site relies on that default and is out of scope for this change.
 */
export async function getPublicSubscriptionPlans(countryCode?: string): Promise<PlanDisplay[]> {
  const code = (countryCode ?? DEFAULT_PRICING_COUNTRY).toUpperCase();
  const pricing = await getPlanPricingConfig(code);
  const currency = getCurrency(code);
  return PLAN_DISPLAY.map((plan) => {
    const entry = pricing[plan.id];
    return {
      ...plan,
      priceMonthly: entry.priceMonthly,
      currency,
      priceLabel: formatPlanPriceLabel(entry, code),
    };
  });
}

export function getPlanDisplay(plan: SubscriptionPlan): PlanDisplay {
  return PLAN_DISPLAY.find((p) => p.id === plan) ?? PLAN_DISPLAY[0];
}

export function getUsageLimits(plan: SubscriptionPlan) {
  return PLAN_FEATURES[plan];
}
