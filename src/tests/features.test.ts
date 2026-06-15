import { describe, it, expect } from "vitest";
import { canUseFeature, getPlanFeatures } from "@/lib/features/plans";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";

describe("Feature gating", () => {
  it("starter plan disables AI", () => {
    expect(canUseFeature(SubscriptionPlan.STARTER, "aiEnabled")).toBe(false);
  });

  it("professional plan enables AI", () => {
    expect(canUseFeature(SubscriptionPlan.PROFESSIONAL, "aiEnabled")).toBe(true);
  });

  it("enterprise has unlimited patients", () => {
    expect(getPlanFeatures(SubscriptionPlan.ENTERPRISE).maxPatients).toBe(-1);
  });
});
