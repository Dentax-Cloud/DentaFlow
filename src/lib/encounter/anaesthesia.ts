/**
 * Anaesthesia/sedation tagging uses the existing ProcedureCatalog.category
 * convention (GPMR `ANAESTHESIA`). No new catalog field.
 *
 * SEDATION / US spelling accepted if a tenant catalog uses them.
 */
const ANAESTHESIA_OR_SEDATION_CATEGORIES = new Set([
  "ANAESTHESIA",
  "ANESTHESIA",
  "SEDATION",
]);

export function isAnaesthesiaOrSedationCategory(
  category: string | null | undefined,
): boolean {
  if (!category) return false;
  return ANAESTHESIA_OR_SEDATION_CATEGORIES.has(category.trim().toUpperCase());
}
