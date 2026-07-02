import { format, isValid, parse } from "date-fns";

export const IMPORT_DATE_FIELDS = [
  "dateOfBirth",
  "insuranceExpiry",
  "expiryDate",
  "joinDate",
] as const;

export type ImportDateField = (typeof IMPORT_DATE_FIELDS)[number];

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

function dateFromIsoParts(iso: string): Date | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);
  return isValid(date) ? date : null;
}

function parseTextDate(value: string, dateFormat: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const iso = dateFromIsoParts(trimmed);
    if (iso) return iso;
  }

  const patterns =
    dateFormat === "MM/DD/YYYY"
      ? ["MM/dd/yyyy", "M/d/yyyy", "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd"]
      : ["dd/MM/yyyy", "d/M/yyyy", "MM/dd/yyyy", "M/d/yyyy", "yyyy-MM-dd"];

  for (const pattern of patterns) {
    const parsed = parse(trimmed, pattern, new Date());
    if (isValid(parsed)) return parsed;
  }

  const native = new Date(trimmed);
  return isValid(native) ? native : null;
}

/** Normalize any import date cell to `yyyy-MM-dd`, or null if unparseable. */
export function parseImportDate(value: unknown, dateFormat: string): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return isValid(value) ? format(value, "yyyy-MM-dd") : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(EXCEL_EPOCH_MS + value * MS_PER_DAY);
    return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : null;
  }

  if (typeof value === "string") {
    const parsed = parseTextDate(value, dateFormat);
    return parsed ? format(parsed, "yyyy-MM-dd") : null;
  }

  return null;
}

/** Parse import date to local midnight `Date` for Prisma date fields. */
export function parseImportDateToLocalDate(value: unknown, dateFormat: string): Date | null {
  const iso = parseImportDate(value, dateFormat);
  if (!iso) return null;
  return dateFromIsoParts(iso);
}

/** Human-readable raw value for error reports (never `Date.toString()`). */
export function formatRawImportValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return isValid(value) ? format(value, "yyyy-MM-dd") : String(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

/** Format a preview-table cell, including normalized date fields. */
export function formatImportCellForDisplay(value: unknown, dateFormat: string): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = parseImportDate(value, dateFormat);
  if (parsed) return parsed;

  return formatRawImportValue(value);
}

export function isImportDateField(key: string): key is ImportDateField {
  return (IMPORT_DATE_FIELDS as readonly string[]).includes(key);
}

export function normalizeImportDateFields(
  row: Record<string, unknown>,
  dateFormat: string,
): Record<string, unknown> {
  const out = { ...row };

  for (const field of IMPORT_DATE_FIELDS) {
    if (!(field in out)) continue;
    const raw = out[field];
    if (raw == null || raw === "") continue;

    const parsed = parseImportDate(raw, dateFormat);
    if (parsed) {
      out[field] = parsed;
    }
  }

  return out;
}
