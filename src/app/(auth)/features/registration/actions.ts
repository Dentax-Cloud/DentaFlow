"use server";

import { registerClinic } from "@/lib/auth/register-clinic";
import type { ClinicRegistrationSubmit } from "@/lib/auth/registration-schema";

export async function registerClinicAction(data: ClinicRegistrationSubmit) {
  return registerClinic(data);
}
