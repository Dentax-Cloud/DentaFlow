import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import type { TenantContext } from "@/lib/tenant/context";
import { can, hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { canAccessPath } from "@/lib/rbac/routes";
import { getNavItemsForRole } from "@/lib/rbac/navigation";
import {
  inclusiveDayCount,
  computeLeaveBalance,
} from "@/lib/hr/leave";
import { isCredentialExpiringSoon } from "@/lib/hr/credential-expiry";
import { HR_MODULE_FLAG, isHrModuleEnabled } from "@/lib/hr/feature-flag";
import { DEFAULT_TENANT_FEATURE_FLAGS } from "@/lib/tenant/default-feature-flags";

const mockRequireTenantContext = vi.hoisted(() => vi.fn());
const mockRequirePermission = vi.hoisted(() => vi.fn());
const mockCreateAuditLog = vi.hoisted(() => vi.fn());
const mockEmployeeFindFirst = vi.hoisted(() => vi.fn());
const mockEmployeeFindMany = vi.hoisted(() => vi.fn());
const mockEmployeeCreate = vi.hoisted(() => vi.fn());
const mockEmployeeUpdate = vi.hoisted(() => vi.fn());
const mockDepartmentFindFirst = vi.hoisted(() => vi.fn());
const mockDepartmentCreate = vi.hoisted(() => vi.fn());
const mockDepartmentFindMany = vi.hoisted(() => vi.fn());
const mockStaffFindFirst = vi.hoisted(() => vi.fn());
const mockDocCreate = vi.hoisted(() => vi.fn());
const mockDocFindMany = vi.hoisted(() => vi.fn());
const mockTimeFindFirst = vi.hoisted(() => vi.fn());
const mockTimeCreate = vi.hoisted(() => vi.fn());
const mockTimeUpdate = vi.hoisted(() => vi.fn());
const mockLeaveTypeFindFirst = vi.hoisted(() => vi.fn());
const mockLeaveTypeFindMany = vi.hoisted(() => vi.fn());
const mockLeaveTypeCreate = vi.hoisted(() => vi.fn());
const mockLeaveFindFirst = vi.hoisted(() => vi.fn());
const mockLeaveCreate = vi.hoisted(() => vi.fn());
const mockLeaveUpdate = vi.hoisted(() => vi.fn());
const mockLeaveAggregate = vi.hoisted(() => vi.fn());
const mockLeaveFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenant/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant/context")>();
  return {
    ...actual,
    requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
  };
});

vi.mock("@/lib/rbac/guard", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/actions/safe-action", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    employee: {
      findFirst: (...a: unknown[]) => mockEmployeeFindFirst(...a),
      findMany: (...a: unknown[]) => mockEmployeeFindMany(...a),
      create: (...a: unknown[]) => mockEmployeeCreate(...a),
      update: (...a: unknown[]) => mockEmployeeUpdate(...a),
    },
    department: {
      findFirst: (...a: unknown[]) => mockDepartmentFindFirst(...a),
      findMany: (...a: unknown[]) => mockDepartmentFindMany(...a),
      create: (...a: unknown[]) => mockDepartmentCreate(...a),
    },
    staffMember: {
      findFirst: (...a: unknown[]) => mockStaffFindFirst(...a),
    },
    employeeDocument: {
      create: (...a: unknown[]) => mockDocCreate(...a),
      findMany: (...a: unknown[]) => mockDocFindMany(...a),
    },
    timeEntry: {
      findFirst: (...a: unknown[]) => mockTimeFindFirst(...a),
      create: (...a: unknown[]) => mockTimeCreate(...a),
      update: (...a: unknown[]) => mockTimeUpdate(...a),
    },
    leaveType: {
      findFirst: (...a: unknown[]) => mockLeaveTypeFindFirst(...a),
      findMany: (...a: unknown[]) => mockLeaveTypeFindMany(...a),
      create: (...a: unknown[]) => mockLeaveTypeCreate(...a),
    },
    leaveRequest: {
      findFirst: (...a: unknown[]) => mockLeaveFindFirst(...a),
      findMany: (...a: unknown[]) => mockLeaveFindMany(...a),
      create: (...a: unknown[]) => mockLeaveCreate(...a),
      update: (...a: unknown[]) => mockLeaveUpdate(...a),
      aggregate: (...a: unknown[]) => mockLeaveAggregate(...a),
    },
  },
}));

function staffContext(
  role: UserRole,
  opts?: { tenantId?: string; staffId?: string; hrEnabled?: boolean },
): TenantContext {
  const tenantId = opts?.tenantId ?? "tenant_a";
  const staffId = opts?.staffId ?? `staff_${role.toLowerCase()}`;
  const staffMember = {
    id: staffId,
    tenantId,
    authUserId: `user_${staffId}`,
    email: `${staffId}@example.com`,
    firstName: "Test",
    lastName: role,
    avatarUrl: null,
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as TenantContext["staffMember"];

  return {
    tenant: {
      id: tenantId,
      name: "Clinic A",
      slug: "clinic-a",
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
      featureFlags: { [HR_MODULE_FLAG]: opts?.hrEnabled !== false },
    } as TenantContext["tenant"],
    staffMember,
    user: staffMember,
    authUserId: `user_${staffId}`,
    tenantSlug: "clinic-a",
    tenantId,
    isSuperAdmin: false,
    trial: {
      isTrialing: false,
      daysRemaining: 0,
      trialDaysRemaining: 0,
      trialEndsAt: null,
    },
  };
}

describe("HR Phase 1 — leave & credential helpers", () => {
  it("counts inclusive calendar days", () => {
    expect(inclusiveDayCount(new Date("2026-08-01"), new Date("2026-08-01"))).toBe(1);
    expect(inclusiveDayCount(new Date("2026-08-01"), new Date("2026-08-03"))).toBe(3);
    expect(inclusiveDayCount(new Date("2026-08-03"), new Date("2026-08-01"))).toBe(0);
  });

  it("computes leave balance without double-counting approved into remaining", () => {
    const bal = computeLeaveBalance({
      leaveTypeId: "lt1",
      name: "Annual",
      entitlement: 20,
      approvedDayCount: 5,
      pendingDayCount: 2,
    });
    expect(bal.usedApproved).toBe(5);
    expect(bal.pending).toBe(2);
    expect(bal.remaining).toBe(15);
  });

  it("flags credentials inside the expiry window and not outside", () => {
    const now = new Date("2026-08-01T12:00:00Z");
    expect(isCredentialExpiringSoon(new Date("2026-08-15"), now, 30)).toBe(true);
    expect(isCredentialExpiringSoon(new Date("2026-08-01"), now, 30)).toBe(true);
    expect(isCredentialExpiringSoon(new Date("2026-09-15"), now, 30)).toBe(false);
    expect(isCredentialExpiringSoon(new Date("2026-07-15"), now, 30)).toBe(false);
    expect(isCredentialExpiringSoon(null, now, 30)).toBe(false);
  });
});

describe("HR Phase 1 — feature flag", () => {
  const prev = process.env.HR_MODULE_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.HR_MODULE_ENABLED;
    else process.env.HR_MODULE_ENABLED = prev;
  });

  it("defaults OFF in DEFAULT_TENANT_FEATURE_FLAGS", () => {
    expect(DEFAULT_TENANT_FEATURE_FLAGS[HR_MODULE_FLAG]).toBe(false);
  });

  it("is off when tenant flag missing/false and env unset", () => {
    delete process.env.HR_MODULE_ENABLED;
    expect(isHrModuleEnabled({ featureFlags: {} })).toBe(false);
    expect(isHrModuleEnabled({ featureFlags: { [HR_MODULE_FLAG]: false } })).toBe(false);
    expect(isHrModuleEnabled({ featureFlags: { [HR_MODULE_FLAG]: true } })).toBe(true);
  });
});

describe("HR Phase 1 — RBAC matrix", () => {
  it("grants hr.read/hr.write to ADMIN and OWNER only by default", () => {
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.hr.read)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.hr.write)).toBe(true);
    expect(hasPermission(UserRole.OWNER, PERMISSIONS.hr.write)).toBe(true);
    for (const role of [
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.RECEPTIONIST,
      UserRole.STORE,
      UserRole.FINANCE,
    ]) {
      expect(can(role, "read", "hr")).toBe(false);
      expect(can(role, "write", "hr")).toBe(false);
    }
  });

  it("allows /hr/me for all roles; blocks /hr directory without hr.read", () => {
    expect(canAccessPath(UserRole.DOCTOR, "/hr/me")).toBe(true);
    expect(canAccessPath(UserRole.STORE, "/hr/me")).toBe(true);
    expect(canAccessPath(UserRole.DOCTOR, "/hr")).toBe(false);
    expect(canAccessPath(UserRole.ADMIN, "/hr")).toBe(true);
    expect(canAccessPath(UserRole.ADMIN, "/hr/leave")).toBe(true);
  });

  it("includes HR nav items for ADMIN only", () => {
    const adminNav = getNavItemsForRole(UserRole.ADMIN);
    expect(adminNav.some((i) => i.href === "/hr")).toBe(true);
    const doctorNav = getNavItemsForRole(UserRole.DOCTOR);
    expect(doctorNav.some((i) => i.href.startsWith("/hr"))).toBe(false);
  });
});

describe("HR Phase 1 — action RBAC & tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(undefined);
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockLeaveAggregate.mockResolvedValue({ _sum: { dayCount: 0 } });
  });

  // First dynamic import of the actions module is slow under parallel vitest load.
  it(
    "rejects createEmployee when HR module is disabled",
    async () => {
      mockRequireTenantContext.mockResolvedValue(
        staffContext(UserRole.ADMIN, { hrEnabled: false }),
      );
      const { createEmployee } = await import("@/app/(dashboard)/features/hr/hr-actions");
      await expect(
        createEmployee({
          firstName: "Ada",
          lastName: "Lovelace",
          hireDate: "2026-01-01",
        }),
      ).rejects.toThrow(/not enabled/i);
    },
    15000,
  );

  it("scopes listEmployees to the current tenantId", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.ADMIN));
    mockEmployeeFindMany.mockResolvedValue([]);
    const { listEmployees } = await import("@/app/(dashboard)/features/hr/hr-actions");
    await listEmployees();
    expect(mockEmployeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant_a", deletedAt: null }),
      }),
    );
  });

  it("denies DOCTOR createEmployee via requirePermission(hr.write)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.DOCTOR));
    mockRequirePermission.mockRejectedValue(new Error("FORBIDDEN"));
    const { createEmployee } = await import("@/app/(dashboard)/features/hr/hr-actions");
    await expect(
      createEmployee({
        firstName: "Ada",
        lastName: "Lovelace",
        hireDate: "2026-01-01",
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(mockRequirePermission).toHaveBeenCalledWith(PERMISSIONS.hr.write);
  });

  it("allows self-service leave submit for linked DOCTOR without hr.write", async () => {
    const ctx = staffContext(UserRole.DOCTOR, { staffId: "staff_doc" });
    mockRequireTenantContext.mockResolvedValue(ctx);
    mockEmployeeFindFirst.mockResolvedValue({
      id: "emp_self",
      tenantId: "tenant_a",
      staffMemberId: "staff_doc",
      deletedAt: null,
    });
    mockLeaveTypeFindFirst.mockResolvedValue({
      id: "lt1",
      tenantId: "tenant_a",
      defaultAnnualEntitlement: 20,
      deletedAt: null,
    });
    mockLeaveCreate.mockResolvedValue({
      id: "lr1",
      status: "pending",
      dayCount: 2,
    });

    const { submitLeaveRequest } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    const row = await submitLeaveRequest({
      leaveTypeId: "lt1",
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    });
    expect(row.id).toBe("lr1");
    expect(mockLeaveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_a",
          employeeId: "emp_self",
          dayCount: 2,
          status: "pending",
        }),
      }),
    );
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it("blocks leave submit that would exceed entitlement (no double-count)", async () => {
    mockRequireTenantContext.mockResolvedValue(
      staffContext(UserRole.DOCTOR, { staffId: "staff_doc" }),
    );
    mockEmployeeFindFirst.mockResolvedValue({
      id: "emp_self",
      tenantId: "tenant_a",
      staffMemberId: "staff_doc",
      deletedAt: null,
    });
    mockLeaveTypeFindFirst.mockResolvedValue({
      id: "lt1",
      tenantId: "tenant_a",
      defaultAnnualEntitlement: 5,
      deletedAt: null,
    });
    mockLeaveAggregate.mockResolvedValue({ _sum: { dayCount: 4 } });

    const { submitLeaveRequest } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    await expect(
      submitLeaveRequest({
        leaveTypeId: "lt1",
        startDate: "2026-09-01",
        endDate: "2026-09-03",
      }),
    ).rejects.toThrow(/Insufficient leave balance/);
  });

  it("requires hr.write to approve leave and scopes lookup by tenant", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.ADMIN));
    mockLeaveFindFirst.mockResolvedValue({
      id: "lr1",
      tenantId: "tenant_a",
      employeeId: "emp1",
      leaveTypeId: "lt1",
      status: "pending",
      dayCount: 2,
      startDate: new Date("2026-09-01"),
      deletedAt: null,
    });
    mockLeaveTypeFindFirst.mockResolvedValue({
      id: "lt1",
      defaultAnnualEntitlement: 20,
    });
    mockLeaveUpdate.mockResolvedValue({ id: "lr1", status: "approved" });

    const { decideLeaveRequest } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    await decideLeaveRequest({ id: "lr1", decision: "approved" });
    expect(mockRequirePermission).toHaveBeenCalledWith(PERMISSIONS.hr.write);
    expect(mockLeaveFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant_a", id: "lr1" }),
      }),
    );
  });

  it("does not surface another tenant's leave request on approve", async () => {
    mockRequireTenantContext.mockResolvedValue(
      staffContext(UserRole.ADMIN, { tenantId: "tenant_a" }),
    );
    mockLeaveFindFirst.mockResolvedValue(null);
    const { decideLeaveRequest } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    await expect(
      decideLeaveRequest({ id: "lr_other_tenant", decision: "approved" }),
    ).rejects.toThrow(/not found/i);
  });

  it("requires hr.write to approve time entries", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.ADMIN));
    mockTimeFindFirst.mockResolvedValue({
      id: "te1",
      tenantId: "tenant_a",
      employeeId: "emp1",
      deletedAt: null,
    });
    mockTimeUpdate.mockResolvedValue({ id: "te1", status: "approved" });
    const { approveTimeEntry } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    await approveTimeEntry("te1");
    expect(mockRequirePermission).toHaveBeenCalledWith(PERMISSIONS.hr.write);
    expect(mockTimeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "approved" }),
      }),
    );
  });

  it("denies DOCTOR updateEmployee on another employee's record", async () => {
    mockRequireTenantContext.mockResolvedValue(
      staffContext(UserRole.DOCTOR, { staffId: "staff_doc" }),
    );
    mockEmployeeFindFirst.mockResolvedValue({
      id: "emp_other",
      tenantId: "tenant_a",
      staffMemberId: "staff_other",
      deletedAt: null,
    });
    const { updateEmployee } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    await expect(
      updateEmployee({ id: "emp_other", jobTitle: "Hacker" }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("allows ADMIN updateEmployee and writes tenant-scoped employee", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.ADMIN));
    mockEmployeeFindFirst.mockResolvedValue({
      id: "emp1",
      tenantId: "tenant_a",
      staffMemberId: null,
      deletedAt: null,
    });
    mockEmployeeUpdate.mockResolvedValue({
      id: "emp1",
      jobTitle: "Hygienist",
    });
    const { updateEmployee } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    await updateEmployee({ id: "emp1", jobTitle: "Hygienist" });
    expect(mockEmployeeUpdate).toHaveBeenCalled();
  });

  it("createEmployee stores optional staffMemberId (not mandatory 1:1)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.ADMIN));
    mockEmployeeCreate.mockResolvedValue({
      id: "emp_new",
      staffMemberId: null,
      firstName: "No",
      lastName: "Login",
    });
    const { createEmployee } = await import(
      "@/app/(dashboard)/features/hr/hr-actions"
    );
    const row = await createEmployee({
      firstName: "No",
      lastName: "Login",
      hireDate: "2026-01-15",
    });
    expect(row.staffMemberId).toBeNull();
    expect(mockEmployeeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_a",
          staffMemberId: null,
        }),
      }),
    );
  });
});
