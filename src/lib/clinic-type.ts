export type ClinicType = "solo" | "practice" | "group";

export function normalizeClinicType(value: string | null | undefined): ClinicType {
  if (value === "solo" || value === "practice" || value === "group") return value;
  return "practice";
}

export function isSoloClinic(clinicType: string | null | undefined): boolean {
  return normalizeClinicType(clinicType) === "solo";
}
