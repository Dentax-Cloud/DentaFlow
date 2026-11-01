import { z } from "zod";

export const CLINIC_TYPE_OPTIONS = ["solo", "practice"] as const;
export type ClinicTypeOption = (typeof CLINIC_TYPE_OPTIONS)[number];

/** Base account fields — plain ZodObject so .omit() / .merge() work. */
export const registrationAccountBaseSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
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

export const DOCTOR_COUNT_OPTIONS = ["1", "2-5", "6-10", "10+"] as const;

export const registrationStep2Schema = z.object({
  clinicName: z.string().min(2, "Clinic name is required"),
  clinicType: z.enum(CLINIC_TYPE_OPTIONS).default("practice"),
  country: z.string().min(2, "Select a country"),
  timezone: z.string().min(1, "Select a timezone"),
  currency: z.string().min(3, "Currency is required"),
  secondaryLanguage: z.string().optional(),
  phone: z.string().optional(),
  specialty: z.string().optional(),
  doctorCountBand: z.enum(DOCTOR_COUNT_OPTIONS).optional(),
  chairCount: z.coerce.number().int().min(1).max(50).default(1),
  doctorCount: z.coerce.number().int().min(1).max(100).default(1),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

export const registrationStep3Schema = z.object({
  taxId: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  expectedMonthlyPatients: z.string().optional(),
  referralSource: z.string().optional(),
});

const registrationAccountFields = registrationAccountBaseSchema.omit({ confirmPassword: true });

export const clinicRegistrationSchema = registrationAccountFields
  .merge(registrationStep2Schema)
  .merge(registrationStep3Schema)
  .extend({
    logoUrl: z.union([z.string().url(), z.literal("")]).optional(),
  });

export const clinicRegistrationServerSchema = clinicRegistrationSchema
  .omit({ password: true, specialty: true, doctorCountBand: true })
  .extend({
    password: z.string().optional(),
    specialties: z.array(z.string()).min(1).default(["General Dentistry"]),
    expectedMonthlyPatients: z.string().default("1-50"),
    referralSource: z.string().default("Website"),
    addressLine1: z.string().default(""),
    city: z.string().default(""),
    phone: z.string().min(1).default(""),
    clinicType: z.enum(CLINIC_TYPE_OPTIONS).default("practice"),
  });

export type RegistrationStep1 = z.infer<typeof registrationAccountBaseSchema>;
export type RegistrationStep2 = z.infer<typeof registrationStep2Schema>;
export type RegistrationStep3 = z.infer<typeof registrationStep3Schema>;
export type ClinicRegistrationData = z.infer<typeof clinicRegistrationSchema>;

export type ClinicRegistrationSubmit = Omit<
  ClinicRegistrationData,
  "password" | "specialty" | "doctorCountBand"
> & {
  password?: string;
  specialty?: string;
  doctorCountBand?: (typeof DOCTOR_COUNT_OPTIONS)[number];
};

export type PendingRegistration = Omit<RegistrationStep1, "password" | "confirmPassword"> &
  RegistrationStep2 &
  RegistrationStep3 & {
    logoUrl?: string;
    logoPreview?: string;
  };

export const registrationStep1OAuthSchema = registrationAccountBaseSchema.omit({
  password: true,
  confirmPassword: true,
});

export function formatAdminName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export function doctorCountFromBand(band?: string): number {
  switch (band) {
    case "1":
      return 1;
    case "2-5":
      return 3;
    case "6-10":
      return 8;
    case "10+":
      return 12;
    default:
      return 1;
  }
}

export function passwordStrengthScore(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Fair", color: "bg-orange-500" };
  if (score <= 4) return { score, label: "Good", color: "bg-yellow-500" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}
