export async function registerClinic(data: ClinicRegistrationSubmit): Promise<RegisterClinicResult> {
  const clinicType = data.clinicType === "solo" ? "solo" : "practice";
  const doctorCount = data.doctorCount ?? doctorCountFromBand(data.doctorCountBand);

  if (clinicType === "solo" && doctorCount > 1) {
    return {
      success: false,
      error: "Solo Doctor clinics are limited to 1 dentist",
      field: "doctorCount",
    };
  }

  const normalized = {
    ...data,
    phone: data.phone?.trim() || "Not provided",
    specialties:
      data.specialties && data.specialties.length > 0
        ? data.specialties
        : data.specialty
          ? [data.specialty]
          : undefined,
    doctorCount: clinicType === "solo" ? 1 : doctorCount,
    addressLine1: data.addressLine1?.trim() || "Address pending",
    city: data.city?.trim() || "City pending",
    clinicType,
  };

  const parsed = clinicRegistrationServerSchema.safeParse(normalized);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path.join(".") || "form";
    return {
      success: false,
      error: firstIssue?.message ?? `Invalid registration data (${field})`,
      field,
    };
  }

  const input = parsed.data;
  const session = await getServerAuthSession();
  const userId = session?.user?.id ?? null;

  if (!userId && input.password) {
    return registerClinicNextAuth(input);
  }

  if (userId) {
    return registerClinicForExistingUser(input, userId);
  }

  return { success: false, error: "Password is required to create an account" };
}
