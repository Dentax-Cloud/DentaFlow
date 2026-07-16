/**
 * Pure helpers for allergy ↔ prescription text cross-check (close-out).
 * No Rx module yet — warn when draft prescription text mentions known allergies.
 */

const ALLERGY_DRUG_ALIASES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "augmentin", "ampicillin"],
  latex: ["latex"],
  fluoride: ["fluoride"],
  lidocaine: ["lidocaine", "lignocaine", "local anaesthetic", "local anesthetic", "xylocaine"],
  adrenaline: ["adrenaline", "epinephrine"],
  codeine: ["codeine", "opioid", "tramadol"],
  nsaid: ["ibuprofen", "nsaid", "aspirin", "naproxen"],
  mercury: ["mercury", "amalgam"],
  nickel: ["nickel"],
};

export type PrescriptionAllergyHit = {
  allergy: string;
  matchedTerm: string;
};

export function findPrescriptionAllergyConflicts(
  allergies: string[] | null | undefined,
  prescriptionText: string,
): PrescriptionAllergyHit[] {
  const text = prescriptionText.trim().toLowerCase();
  if (!text || !allergies?.length) return [];

  const hits: PrescriptionAllergyHit[] = [];
  for (const raw of allergies) {
    const allergy = raw.trim();
    if (!allergy) continue;
    const key = allergy.toLowerCase();
    const terms = new Set<string>([key]);
    for (const [canon, aliases] of Object.entries(ALLERGY_DRUG_ALIASES)) {
      if (key.includes(canon) || aliases.some((a) => key.includes(a))) {
        aliases.forEach((a) => terms.add(a));
        terms.add(canon);
      }
    }
    for (const term of terms) {
      if (term.length >= 3 && text.includes(term)) {
        hits.push({ allergy, matchedTerm: term });
        break;
      }
    }
  }
  return hits;
}

/** Treatment item IDs that should be marked completed from completed spine lines. */
export function treatmentItemIdsForWriteBack(
  lines: Array<{ status: string; treatmentItemId: string | null }>,
): string[] {
  return lines
    .filter((l) => l.status === "completed" && l.treatmentItemId)
    .map((l) => l.treatmentItemId as string);
}
