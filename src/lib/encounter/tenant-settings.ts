import { clampStaleAfterMinutes } from "./gates/insurance";

export type EncounterSpineTenantSettings = {
  /** Hours until insurance verification is stale. Clamped to 12–72. Default 24. */
  insuranceStaleAfterHours: number;
  /** Pain score (0–10) that forces next-action + ClinicalAlert. Default 7. */
  painScoreThreshold: number;
};

export const DEFAULT_ENCOUNTER_SPINE_SETTINGS: EncounterSpineTenantSettings = {
  insuranceStaleAfterHours: 24,
  painScoreThreshold: 7,
};

type JsonLike = Record<string, unknown> | null | undefined;

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

/**
 * Read Module 6 gate defaults from Settings.encounterSpineSettings
 * (falls back to featureFlags.encounterSpine, then hard defaults).
 */
export function resolveEncounterSpineSettings(input: {
  settingsJson?: JsonLike;
  featureFlags?: JsonLike;
}): EncounterSpineTenantSettings {
  const fromSettings =
    input.settingsJson && typeof input.settingsJson === "object" && !Array.isArray(input.settingsJson)
      ? input.settingsJson
      : null;
  const fromFlags =
    input.featureFlags &&
    typeof input.featureFlags === "object" &&
    !Array.isArray(input.featureFlags) &&
    typeof (input.featureFlags as Record<string, unknown>).encounterSpine === "object" &&
    (input.featureFlags as Record<string, unknown>).encounterSpine !== null &&
    !Array.isArray((input.featureFlags as Record<string, unknown>).encounterSpine)
      ? ((input.featureFlags as Record<string, unknown>).encounterSpine as Record<string, unknown>)
      : null;

  const raw = fromSettings ?? fromFlags ?? {};
  const hours = asNumber(
    raw.insuranceStaleAfterHours ?? raw.staleAfterHours,
    DEFAULT_ENCOUNTER_SPINE_SETTINGS.insuranceStaleAfterHours,
  );
  const threshold = asNumber(
    raw.painScoreThreshold,
    DEFAULT_ENCOUNTER_SPINE_SETTINGS.painScoreThreshold,
  );

  const clampedHours = Math.min(72, Math.max(12, Math.round(hours)));
  const clampedThreshold = Math.min(10, Math.max(0, Math.round(threshold)));

  return {
    insuranceStaleAfterHours: clampedHours,
    painScoreThreshold: clampedThreshold,
  };
}

export function staleAfterMinutesFromSettings(
  settings: EncounterSpineTenantSettings,
): number {
  return clampStaleAfterMinutes(settings.insuranceStaleAfterHours * 60);
}
