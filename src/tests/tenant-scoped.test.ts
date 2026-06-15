import { describe, it, expect } from "vitest";
import { tenantWhere, withTenantId } from "@/lib/tenant/scoped";

describe("Tenant scoping helpers", () => {
  it("tenantWhere merges tenantId", () => {
    expect(tenantWhere("tenant_1", { id: "pat_1" })).toEqual({
      id: "pat_1",
      tenantId: "tenant_1",
    });
  });

  it("withTenantId adds tenantId to data", () => {
    expect(withTenantId("tenant_1", { name: "Test" })).toEqual({
      name: "Test",
      tenantId: "tenant_1",
    });
  });
});
