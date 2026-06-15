import { z } from "zod";

/** Base account fields — plain ZodObject so .omit() / .merge() work. */
export const registrationAccountBaseSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(6, "Phone number is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number"),
  confirmPassword: z.string(),
});

/** Step 1 form schema with password confirmation check. */
export const registrationStep1Schema = registrationAccountBaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords do not match", path: ["confirmPassword"] },
);

export const registrationStep2Schema = z.object({
  clinicName: z.string().min(2, "Clinic name is required"),
  country: z.string().min(2, "Select a country"),
  timezone: z.string().min(1, "Select a timezone"),
  currency: z.string().min(3, "Currency is required"),
  chairCount: z.coerce.number().int().min(1).max(50),
  doctorCount: z.coerce.number().int().min(1).max(100),
  addressLine1: z.string().min(3, "Street address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

export const registrationStep3Schema = z.object({
  taxId: z.string().optional(),
  specialties: z.array(z.string()).min(1, "Select at least one specialty"),
  expectedMonthlyPatients: z.string().min(1, "Select an expected patient volume"),
  referralSource: z.string().min(1, "Let us know how you heard about us"),
});

const registrationAccountFields = registrationAccountBaseSchema.omit({ confirmPassword: true });

export const clinicRegistrationSchema = registrationAccountFields
  .merge(registrationStep2Schema)
  .merge(registrationStep3Schema)
  .extend({
    logoUrl: z.union([z.string().url(), z.literal("")]).optional(),
  });

/** Server-side — password optional when account already exists (OAuth). */
export const clinicRegistrationServerSchema = clinicRegistrationSchema
  .omit({ password: true })
  .extend({
    password: z.string().optional(),
  });

export type RegistrationStep1 = z.infer<typeof registrationAccountBaseSchema>;
export type RegistrationStep2 = z.infer<typeof registrationStep2Schema>;
export type RegistrationStep3 = z.infer<typeof registrationStep3Schema>;
export type ClinicRegistrationData = z.infer<typeof clinicRegistrationSchema>;

/** Client → server payload (password optional for OAuth users). */
export type ClinicRegistrationSubmit = Omit<ClinicRegistrationData, "password"> & {
  password?: string;
};

export type PendingRegistration = Omit<RegistrationStep1, "password" | "confirmPassword"> &
  RegistrationStep2 &
  RegistrationStep3 & {
    logoUrl?: string;
    logoPreview?: string;
  };

/** OAuth users skip password fields on step 1. */
export const registrationStep1OAuthSchema = registrationAccountBaseSchema.omit({
  password: true,
  confirmPassword: true,
});

export function formatAdminName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}
