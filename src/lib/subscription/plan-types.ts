import { z } from "zod";

/**
 * Runtime-safe subscription plan enum.
 * Mirrors Prisma `SubscriptionPlan` — use this instead of `@prisma/client` in
 * modules that may load in the browser (pricing, marketing, client components).
 */
export const SUBSCRIPTION_PLAN_VALUES = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN_VALUES)[number];

export const SubscriptionPlan = {
  STARTER: "STARTER",
  PROFESSIONAL: "PROFESSIONAL",
  ENTERPRISE: "ENTERPRISE",
} as const satisfies Record<string, SubscriptionPlan>;

export const subscriptionPlanSchema = z.enum(SUBSCRIPTION_PLAN_VALUES);

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (SUBSCRIPTION_PLAN_VALUES as readonly string[]).includes(value);
}
