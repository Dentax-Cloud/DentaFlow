import type { StaffMember } from "@prisma/client";

/** Display labels for staff lifecycle — use consistently across team UI. */
export type StaffDisplayStatus = "Invited" | "Active" | "Suspended";

export function getStaffMemberDisplayStatus(
  member: Pick<StaffMember, "authUserId" | "isActive">,
): StaffDisplayStatus {
  if (!member.isActive) return "Suspended";
  if (!member.authUserId) return "Invited";
  return "Active";
}

export function staffStatusBadgeVariant(
  status: StaffDisplayStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "Active":
      return "default";
    case "Invited":
      return "secondary";
    case "Suspended":
      return "outline";
  }
}
