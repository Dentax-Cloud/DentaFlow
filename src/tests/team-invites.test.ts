import { describe, it, expect } from "vitest";
import { UserRole } from "@prisma/client";
import {
  resolveProvisionedUserRole,
  readDentaflowRoleFromMetadata,
  dentaflowRoleMetadata,
} from "@/lib/tenant/team-roles";
import { isClinicalInviteRole, toStaffInviteProfileData } from "@/lib/staff/invite-profile";
import { getStaffMemberDisplayStatus } from "@/lib/staff/staff-status";

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

describe("invite acceptance profile", () => {
  it("maps form fields to staff profile data", () => {
    expect(
      toStaffInviteProfileData({
        firstName: "Jane",
        lastName: "Doe",
        phone: "+971501234567",
        emergencyContactName: "John Doe",
        emergencyContactPhone: "+971509876543",
        addressLine1: "Office 12",
        city: "Dubai",
        country: "UAE",
        licenseNumber: "LIC-123",
      }),
    ).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      phone: "+971501234567",
      emergencyContactName: "John Doe",
      emergencyContactPhone: "+971509876543",
      addressLine1: "Office 12",
      city: "Dubai",
      country: "UAE",
      licenseNumber: "LIC-123",
    });
  });

  it("detects clinical invite roles for license field", () => {
    expect(isClinicalInviteRole("DOCTOR")).toBe(true);
    expect(isClinicalInviteRole("HYGIENIST")).toBe(true);
    expect(isClinicalInviteRole("RECEPTIONIST")).toBe(false);
  });
});

describe("staff display status", () => {
  it("derives invited, active, and suspended consistently", () => {
    expect(
      getStaffMemberDisplayStatus({ authUserId: null, isActive: true }),
    ).toBe("Invited");
    expect(
      getStaffMemberDisplayStatus({ authUserId: "auth_1", isActive: true }),
    ).toBe("Active");
    expect(
      getStaffMemberDisplayStatus({ authUserId: "auth_1", isActive: false }),
    ).toBe("Suspended");
  });
});
