import { GateAssertionError } from "@/lib/encounter/errors";

/**
 * ASA Physical Status Classification I–VI, with optional emergency "E" suffix.
 * Stored on RiskAssessment.asaClass as e.g. "II" or "II-E". No prior in-app
 * ASA enum existed (free-text); this matches the standard clinical coding.
 */
export const ASA_CLASS_VALUES = [
  "I",
  "I-E",
  "II",
  "II-E",
  "III",
  "III-E",
  "IV",
  "IV-E",
  "V",
  "V-E",
  "VI",
  "VI-E",
] as const;

export type AsaClass = (typeof ASA_CLASS_VALUES)[number];

const ASA_CLASS_SET = new Set<string>(ASA_CLASS_VALUES);

export function normalizeAsaClass(raw: string | null | undefined): AsaClass | null {
  if (raw == null) return null;
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "").replace(/^ASA/, "");
  if (!compact) return null;
  const hyphenated = compact.replace(/^([IVX]+)E$/, "$1-E");
  if (ASA_CLASS_SET.has(hyphenated)) return hyphenated as AsaClass;
  return null;
}

export function isValidAsaClass(raw: string | null | undefined): boolean {
  return normalizeAsaClass(raw) != null;
}

export function asaClassOptionLabel(value: AsaClass): string {
  if (value.endsWith("-E")) {
    return `ASA ${value.replace(/-E$/, "")} E (emergency)`;
  }
  return `ASA ${value}`;
}

export function requireAsaClassForRiskClear(raw: string | null | undefined): AsaClass {
  const normalized = normalizeAsaClass(raw);
  if (!normalized) {
    throw new GateAssertionError(
      "Select an ASA class (I–VI, optional emergency E) before clearing risk.",
    );
  }
  return normalized;
}
