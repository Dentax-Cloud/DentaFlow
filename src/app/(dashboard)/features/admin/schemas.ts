import { z } from "zod";
import { UserRole } from "@prisma/client";
import { INVITABLE_ROLES } from "@/lib/tenant/team-roles";

const invitableRoleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.DENTIST,
  UserRole.HYGIENIST,
  UserRole.RECEPTIONIST,
  UserRole.ACCOUNTANT,
  UserRole.MANAGER,
]);

export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  role: invitableRoleSchema,
});

export const updateTeamMemberRoleSchema = z.object({
  userId: z.string().min(1),
  role: invitableRoleSchema,
});

export const removeTeamMemberSchema = z.object({
  userId: z.string().min(1),
});

export const updateClinicSettingsSchema = z.object({
  currency: z
    .string()
    .trim()
    .min(3, "Currency code is required")
    .max(3, "Use a 3-letter currency code")
    .transform((v) => v.toUpperCase()),
  taxRate: z.coerce
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%"),
  enablePatientPortal: z.boolean(),
  enableOnlinePayments: z.boolean(),
});

export { INVITABLE_ROLES };
