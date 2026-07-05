import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { createAction, __setTestTenantContext, __clearTestTenantContext } from "@/lib/actions/safe-action";
import { UserRole, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";

describe("server actions integration (harness)", () => {
  beforeEach(() => {
    const staffMember = {
      id: "user_test",
      tenantId: "tenant_test",
      authUserId: "user_test",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      avatarUrl: null,
      role: UserRole.OWNER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as Parameters<typeof __setTestTenantContext>[0]["staffMember"];

    __setTestTenantContext({
      tenant: {
        id: "tenant_test",
        name: "Test Clinic",
        slug: "test-clinic",
        email: null,
        phone: null,
        address: null,
        city: null,
        country: null,
        timezone: "UTC",
        logoUrl: null,
        subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        onboardingCompleted: true,
        status: TenantStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as Parameters<typeof __setTestTenantContext>[0]["tenant"],
      staffMember,
      user: staffMember,
      authUserId: "user_test",
      tenantSlug: "test-clinic",
      tenantId: "tenant_test",
      isSuperAdmin: false,
      trial: {
        isTrialing: false,
        daysRemaining: 0,
        trialEndsAt: null,
        isExpired: false,
      },
      countryProfile: {} as Parameters<typeof __setTestTenantContext>[0]["countryProfile"],
      currency: "AED",
      taxRate: 5,
      taxName: "VAT",
    } as unknown as Parameters<typeof __setTestTenantContext>[0]);
  });

  afterEach(() => {
    __clearTestTenantContext();
  });

  it("runs an action without Clerk auth (via injected ctx)", async () => {
    const testAction = createAction({
      schema: z.object({ x: z.number() }),
      handler: async (input, ctx) => {
        return { x: input.x, tenantId: ctx.tenant.id, role: ctx.user?.role ?? UserRole.RECEPTIONIST };
      },
    });

    const res = await testAction({ x: 1 });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.tenantId).toBe("tenant_test");
      expect(res.data.role).toBe(UserRole.OWNER);
    }
  });
});

