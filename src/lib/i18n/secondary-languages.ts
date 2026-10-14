/**
 * Curated list of "preferred second language" options a clinic can choose
 * during registration. Deliberately limited to languages that match
 * DentaFlow's actual tenant footprint (GCC + India country packs, plus
 * GB/US/AU/SG) and realistic patient populations — not an exhaustive list
 * of world languages.
 */
export const SECONDARY_LANGUAGES = [
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو" },
  { code: "tl", label: "Tagalog (Filipino)", nativeLabel: "Tagalog" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "zh", label: "Mandarin Chinese", nativeLabel: "中文" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
] as const;

export type SecondaryLanguageCode = (typeof SECONDARY_LANGUAGES)[number]["code"];

export function isSecondaryLanguageCode(value: unknown): value is SecondaryLanguageCode {
  return typeof value === "string" && SECONDARY_LANGUAGES.some((l) => l.code === value);
}

export function secondaryLanguageLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return SECONDARY_LANGUAGES.find((l) => l.code === code)?.label ?? null;
}

export function secondaryLanguageNativeLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return SECONDARY_LANGUAGES.find((l) => l.code === code)?.nativeLabel ?? null;
}

/** Normalizes a country profile's default secondary language into one of
 * our curated codes, falling back to null when it isn't on the curated list
 * (e.g. a country pack suggests a language we don't yet support translations for). */
export function normalizeSecondaryLanguage(code: string | null | undefined): SecondaryLanguageCode | null {
  if (!code) return null;
  return isSecondaryLanguageCode(code) ? code : null;
}
