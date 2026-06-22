import { describe, it, expect } from "vitest";
import { UserRole } from "@prisma/client";
import {
  resolveProvisionedUserRole,
  readDentaflowRoleFromMetadata,
  dentaflowRoleMetadata,
} from "@/lib/tenant/team-roles";

describe("team invite role mapping", () => {
  it("stores and reads dentaflow role metadata", () => {
    const metadata = dentaflowRoleMetadata(UserRole.DOCTOR);
    expect(readDentaflowRoleFromMetadata(metadata)).toBe(UserRole.DOCTOR);
  });

  it("resolves invited user role from pending invite metadata", () => {
    expect(
      resolveProvisionedUserRole({
        pendingInviteRole: UserRole.FINANCE,
      }),
    ).toBe(UserRole.FINANCE);
  });

  it("falls back to receptionist when no invite role", () => {
    expect(resolveProvisionedUserRole({})).toBe(UserRole.RECEPTIONIST);
  });
});
