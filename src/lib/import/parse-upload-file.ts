import * as XLSX from "xlsx";
import { getCountryProfile } from "@/lib/countries";
import { db } from "@/lib/db";
import { normalizeImportDateFields } from "@/lib/import/parse-import-date";
import type { ImportEntity } from "@/lib/import/template-generator";

const STATIC_HEADER_MAP: Record<string, string> = {
  "First Name": "firstName",
  "Middle Name": "middleName",
  "Last Name": "lastName",
  "Father's Name": "fatherName",
  "Grandfather's Name": "grandfatherName",
  "Family Name": "lastName",
  Gender: "gender",
  Nationality: "nationality",
  Email: "email",
  "Emergency Contact Name": "emergencyContactName",
  "Emergency Contact Phone": "emergencyContactPhone",
  "Insurance Provider": "insuranceProvider",
  "Insurance Network": "insuranceNetwork",
  "Insurance Member ID": "insuranceMemberId",
  "Policy Number": "insurancePolicyNo",
  "Blood Group": "bloodGroup",
  Allergies: "allergies",
  "Medical Notes": "medicalNotes",
  Occupation: "occupation",
  "Item Name": "name",
  "Internal Code": "itemRef",
  Category: "category",
  Unit: "unit",
  "Opening Stock": "currentStock",
  "Minimum Stock": "minimumStock",
  "Maximum Stock": "maximumStock",
  "Supplier Name": "supplierName",
  "Supplier Barcode": "supplierBarcode",
  "Storage Location": "storageLocation",
  "License Number": "licenseNumber",
  Specialization: "specialization",
  Role: "role",
  "Procedure Code": "code",
  "Procedure Name": "name",
  Description: "description",
  Price: "price",
  "Duration (minutes)": "durationMinutes",
};

function buildHeaderMap(countryCode: string, currency: string): Map<string, string> {
  const profile = getCountryProfile(countryCode);
  const map = new Map<string, string>(Object.entries(STATIC_HEADER_MAP));

  map.set(`Date of Birth (${profile.dateFormat})`, "dateOfBirth");
  map.set(`Phone (${profile.dialCode})`, "phone");
  map.set(`Insurance Expiry (${profile.dateFormat})`, "insuranceExpiry");
  map.set(`Expiry Date (${profile.dateFormat})`, "expiryDate");
  map.set(`Join Date (${profile.dateFormat})`, "joinDate");
  map.set(`Cost Price (${currency})`, "costPrice");
  map.set(`Selling Price (${currency})`, "sellingPrice");
  map.set(`Price (${currency})`, "price");
  map.set("Phone", "phone");

  for (const doc of profile.identityDocuments) {
    map.set(doc.label, `idDoc_${doc.key}`);
  }

  return map;
}

function cleanHeader(header: string): string {
  return header.replace(/\s*\*$/, "").trim();
}

export function normalizeImportRow(
  row: Record<string, unknown>,
  headerMap: Map<string, string>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [header, value] of Object.entries(row)) {
    if (header.startsWith("__EMPTY")) continue;
    const clean = cleanHeader(header);
    let key = headerMap.get(clean);

    if (!key) {
      key = clean
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
        .replace(/^./, (c) => c.toLowerCase());
    }

    normalized[key] = value;
  }

  return normalized;
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => v == null || String(v).trim() === "");
}

export async function parseImportFileBuffer(
  buffer: Buffer,
  fileName: string,
  tenantId: string,
  countryCode: string,
  currency: string,
): Promise<Record<string, unknown>[]> {
  const customFields = await db.tenantCustomField.findMany({
    where: { tenantId, entity: "PATIENT", isActive: true },
    select: { fieldKey: true, fieldLabel: true },
  });

  const headerMap = buildHeaderMap(countryCode, currency);
  for (const cf of customFields) {
    headerMap.set(cf.fieldLabel, `custom_${cf.fieldKey}`);
  }

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: isCsv ? 0 : 1,
    defval: null,
  });

  const profile = getCountryProfile(countryCode);

  return rawData
    .map((row) => normalizeImportRow(row, headerMap))
    .map((row) => normalizeImportDateFields(row, profile.dateFormat))
    .filter((row) => !isEmptyRow(row));
}

export function parseImportFileForPreview(
  buffer: ArrayBuffer,
  fileName: string,
  countryCode: string,
  currency: string,
  customFields: Array<{ fieldKey: string; fieldLabel: string }>,
): Record<string, unknown>[] {
  const headerMap = buildHeaderMap(countryCode, currency);
  for (const cf of customFields) {
    headerMap.set(cf.fieldLabel, `custom_${cf.fieldKey}`);
  }

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: false,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: isCsv ? 0 : 1,
    defval: null,
  });

  const profile = getCountryProfile(countryCode);

  return rawData
    .map((row) => normalizeImportRow(row, headerMap))
    .map((row) => normalizeImportDateFields(row, profile.dateFormat))
    .filter((row) => !isEmptyRow(row));
}

export type { ImportEntity };
