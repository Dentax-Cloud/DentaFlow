"use server";

import { registerClinic } from "@/lib/auth/register-clinic";
import type { ClinicRegistrationSubmit } from "@/lib/auth/registration-schema";

export async function registerClinicAction(data: ClinicRegistrationSubmit) {
  const result = await registerClinic(data);
  if (!result.success) return result;
  const redirectUrl = data.clinicType === "solo" ? "/solo" : "/dashboard";
  return { ...result, redirectUrl };
}
