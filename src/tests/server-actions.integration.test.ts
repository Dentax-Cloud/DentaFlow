import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { createAction, __setTestTenantContext, __clearTestTenantContext } from "@/lib/actions/safe-action";
import { UserRole, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";

describe("server actions integration (harness)", () => {
  beforeEach(() => {
    __setTestTenantContext({
      tenant: {
        id: "tenant_test",
        clerkOrgId: "org_test",
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
      } as any,
      user: {
        id: "user_test",
        tenantId: "tenant_test",
        clerkUserId: "user_test",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        avatarUrl: null,
        role: UserRole.OWNER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any,
      clerkUserId: "user_test",
      orgId: "org_test",
    } as any);
  });

  afterEach(() => {
    __clearTestTenantContext();
  });

  it("runs an action without Clerk auth (via injected ctx)", async () => {
    const testAction = createAction({
      schema: z.object({ x: z.number() }),
      handler: async (input, ctx) => {
        return { x: input.x, tenantId: ctx.tenant.id, role: ctx.user.role };
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

