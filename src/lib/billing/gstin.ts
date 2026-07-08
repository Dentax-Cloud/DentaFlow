/** Indian GSTIN — 15 chars: state (2) + PAN (10) + entity (1) + Z + checksum (1). */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const GSTIN_FORMAT_ERROR =
  "Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5 (15 characters: state code + PAN + entity number + Z + checksum)";

export function isValidGstin(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return GSTIN_REGEX.test(trimmed.toUpperCase());
}
