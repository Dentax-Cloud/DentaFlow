import { z } from "zod";

export const inviteAcceptProfileSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  licenseNumber: z.string().trim().optional(),
});

export type InviteAcceptProfile = z.infer<typeof inviteAcceptProfileSchema>;

export type StaffInviteProfileData = {
  firstName: string;
  lastName: string;
  phone: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  licenseNumber: string | null;
};

export function toStaffInviteProfileData(
  input: Pick<
    InviteAcceptProfile,
    | "firstName"
    | "lastName"
    | "phone"
    | "emergencyContactName"
    | "emergencyContactPhone"
    | "addressLine1"
    | "city"
    | "country"
    | "licenseNumber"
  >,
): StaffInviteProfileData {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone.trim(),
    emergencyContactName: input.emergencyContactName?.trim() || null,
    emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
    addressLine1: input.addressLine1?.trim() || null,
    city: input.city?.trim() || null,
    country: input.country?.trim() || null,
    licenseNumber: input.licenseNumber?.trim() || null,
  };
}

/** Invited roles that may provide a professional license number at onboarding. */
export function isClinicalInviteRole(role: string): boolean {
  const normalized = role.toUpperCase();
  return normalized === "DOCTOR" || normalized === "DENTIST" || normalized === "HYGIENIST";
}
