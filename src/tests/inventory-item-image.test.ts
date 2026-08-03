import { createElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import {
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import type { TenantContext } from "@/lib/tenant/context";
import { InventoryItemThumb } from "@/components/inventory/inventory-item-thumb";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";

const mockRequireTenantContext = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockCreateAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenant/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant/context")>();
  return {
    ...actual,
    requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    inventoryItem: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

vi.mock("@/lib/actions/safe-action", () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
  createAction: vi.fn(),
}));

function staffContext(role: UserRole, idSuffix: string): TenantContext {
  const staffMember = {
    id: `staff_${idSuffix}`,
    tenantId: "tenant_test",
    authUserId: `user_${idSuffix}`,
    email: `${idSuffix}@example.com`,
    firstName: idSuffix,
    lastName: "User",
    avatarUrl: null,
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as TenantContext["staffMember"];

  return {
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
      featureFlags: {},
    } as TenantContext["tenant"],
    staffMember,
    user: staffMember,
    authUserId: `user_${idSuffix}`,
    tenantSlug: "test-clinic",
    tenantId: "tenant_test",
    isSuperAdmin: false,
    trial: {
      isTrialing: false,
      daysRemaining: 0,
      trialEndsAt: null,
      isExpired: false,
    },
    countryProfile: {} as TenantContext["countryProfile"],
    currency: "AED",
    taxRate: 5,
    taxName: "VAT",
  };
}

describe("inventory item imageUrl", () => {
  afterEach(() => {
    cleanup();
  });

  it("role matrix: STORE/ADMIN have inventory.write; DOCTOR does not", () => {
    expect(hasPermission(UserRole.STORE, PERMISSIONS.inventory.write)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.inventory.write)).toBe(true);
    expect(hasPermission(UserRole.OWNER, PERMISSIONS.inventory.write)).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.inventory.write)).toBe(false);
  });

  it("wires list thumbs + detail photo upload + UploadThing route", () => {
    const list = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/inventory-client.tsx"),
      "utf8",
    );
    const detail = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/[id]/inventory-item-client.tsx"),
      "utf8",
    );
    const core = readFileSync(
      resolve(__dirname, "../app/api/uploadthing/core.ts"),
      "utf8",
    );
    expect(list).toContain("InventoryItemThumb");
    expect(list).toContain("imageUrl={item.imageUrl}");
    expect(detail).toContain("InventoryItemPhotoUpload");
    expect(detail).toContain("canWriteInventory");
    expect(core).toContain("inventoryItemImage");
    expect(core).toContain("PERMISSIONS.inventory.write");
    expect(core).toContain('"image/jpeg"');
    expect(core).toContain('"image/png"');
  });

  it("renders package placeholder when imageUrl is null", () => {
    const { container } = render(
      createElement(InventoryItemThumb, {
        imageUrl: null,
        name: "Gloves",
        size: "sm",
      }),
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders real thumbnail when imageUrl is set", () => {
    const { container } = render(
      createElement(InventoryItemThumb, {
        imageUrl: "https://example.com/item.png",
        name: "Gloves",
        size: "sm",
      }),
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.com/item.png");
    expect(img?.getAttribute("alt")).toBe("Gloves");
  });
});

describe("setInventoryItemImageUrl permission", () => {
  const ACTION_MS = 60_000;
  let setInventoryItemImageUrl: typeof import("@/app/(dashboard)/features/inventory/inventory-actions").setInventoryItemImageUrl;

  beforeAll(async () => {
    ({ setInventoryItemImageUrl } = await import(
      "@/app/(dashboard)/features/inventory/inventory-actions"
    ));
  }, ACTION_MS);

  beforeEach(() => {
    mockRequireTenantContext.mockReset();
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
    mockCreateAuditLog.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it(
    "denies DOCTOR (no inventory.write)",
    async () => {
      mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.DOCTOR, "doctor"));
      let caught: unknown;
      try {
        await setInventoryItemImageUrl({
          inventoryItemId: "item_1",
          imageUrl: "https://example.com/a.jpg",
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("FORBIDDEN");
      expect(mockUpdate).not.toHaveBeenCalled();
    },
    ACTION_MS,
  );

  it(
    "allows STORE and writes imageUrl with audit",
    async () => {
      mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
      mockFindFirst.mockResolvedValue({ id: "item_1", imageUrl: null });
      mockUpdate.mockResolvedValue({ id: "item_1", imageUrl: "https://example.com/a.jpg" });
      mockCreateAuditLog.mockResolvedValue(undefined);

      const result = await setInventoryItemImageUrl({
        inventoryItemId: "item_1",
        imageUrl: "https://example.com/a.jpg",
      });

      expect(result).toEqual({ ok: true, imageUrl: "https://example.com/a.jpg" });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "item_1" },
        data: { imageUrl: "https://example.com/a.jpg" },
      });
      expect(mockCreateAuditLog).toHaveBeenCalled();
    },
    ACTION_MS,
  );
});
