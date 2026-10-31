export type ClinicMode = "solo" | "practice" | "group";

export function isSoloMode(mode: string | null | undefined): boolean {
  return mode === "solo";
}

export function normalizeClinicMode(mode: string | null | undefined): ClinicMode {
  if (mode === "solo" || mode === "practice" || mode === "group") return mode;
  return "group";
}
