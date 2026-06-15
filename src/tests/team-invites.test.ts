import { describe, it, expect } from "vitest";
import { UserRole } from "@prisma/client";
import {
  mapUserRoleToClerkMembershipRole,
  resolveProvisionedUserRole,
  readDentaflowRoleFromMetadata,
  dentaflowRoleMetadata,
} from "@/lib/tenant/clerk-roles";

describe("Clerk team invite role mapping", () => {
  it("maps all app roles to Clerk default membership roles only", () => {
    expect(mapUserRoleToClerkMembershipRole(UserRole.RECEPTIONIST)).toBe("org:member");
    expect(mapUserRoleToClerkMembershipRole(UserRole.DOCTOR)).toBe("org:member");
    expect(mapUserRoleToClerkMembershipRole(UserRole.FINANCE)).toBe("org:member");
    expect(mapUserRoleToClerkMembershipRole(UserRole.STORE)).toBe("org:member");
    expect(mapUserRoleToClerkMembershipRole(UserRole.ADMIN)).toBe("org:admin");
  });

  it("stores and reads dentaflow role metadata", () => {
    const metadata = dentaflowRoleMetadata(UserRole.DOCTOR);
    expect(readDentaflowRoleFromMetadata(metadata)).toBe(UserRole.DOCTOR);
  });

  it("resolves invited user role from pending invite metadata", () => {
    expect(
      resolveProvisionedUserRole({
        clerkMembershipRole: "org:member",
        pendingInviteRole: UserRole.FINANCE,
      }),
    ).toBe(UserRole.FINANCE);
  });

  it("falls back to receptionist for plain org:member without metadata", () => {
    expect(
      resolveProvisionedUserRole({
        clerkMembershipRole: "org:member",
      }),
    ).toBe(UserRole.RECEPTIONIST);
  });

  it("maps admin clerk role without metadata", () => {
    expect(
      resolveProvisionedUserRole({
        clerkMembershipRole: "org:admin",
      }),
    ).toBe(UserRole.ADMIN);
  });
});
