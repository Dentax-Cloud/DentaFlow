import { db } from "@/lib/db";
import { getCountryProfile } from "@/lib/countries";
import { randomUUID } from "crypto";
import { generatePatientId } from "@/lib/ids/generate-ids";
import { generatePatientNumber } from "@/lib/utils";
import type { ImportEntity } from "@/lib/import/template-generator";
import {
  formatRawImportValue,
  parseImportDateToLocalDate,
} from "@/lib/import/parse-import-date";

export type ImportMode = "CREATE_ONLY" | "UPDATE_ONLY" | "UPSERT";

export type ImportFieldError = {
  field: string;
  rawValue: string;
  reason: string;
};

export type ImportRowResult = {
  rowNumber: number;
  status: "SUCCESS" | "WARNING" | "ERROR" | "SKIPPED";
  message?: string;
  warnings?: string[];
  fieldErrors?: ImportFieldError[];
  patientId?: string;
  action?: "CREATED" | "UPDATED" | "SKIPPED";
};

export type ImportBatchResult = {
  batchId: string;
  total: number;
  success: number;
  warnings: number;
  errors: number;
  skipped: number;
  results: ImportRowResult[];
};

type CustomFieldDef = {
  id: string;
  fieldKey: string;
  fieldType: string;
};

type ImportRow = Record<string, unknown>;

function cellValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return formatRawImportValue(value);
  return String(value).trim();
}

function importDateFieldError(
  field: string,
  raw: unknown,
  dateFormat: string,
): ImportFieldError {
  const rawValue = formatRawImportValue(raw);
  const reason = `could not parse '${rawValue}' as a date (expected ${dateFormat})`;
  return { field, rawValue, reason };
}

async function findExistingPatient(
  tenantId: string,
  row: ImportRow,
  countryCode: string,
): Promise<string | null> {
  const profile = getCountryProfile(countryCode);

  for (const doc of profile.identityDocuments) {
    const idValue = cellValue(row[`idDoc_${doc.key}`]);
    if (idValue) {
      const patient = await db.patient.findFirst({
        where: {
          tenantId,
          idDocumentNumber: idValue,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (patient) return patient.id;
    }
  }

  const email = cellValue(row.email).toLowerCase();
  if (email) {
    const patient = await db.patient.findFirst({
      where: { tenantId, email, deletedAt: null },
      select: { id: true },
    });
    if (patient) return patient.id;
  }

  const phone = cellValue(row.phone);
  const dob = parseImportDateToLocalDate(row.dateOfBirth, profile.dateFormat);
  if (phone && dob) {
    const patient = await db.patient.findFirst({
      where: {
        tenantId,
        phone: { contains: phone.replace(/\D/g, "").slice(-9) },
        dateOfBirth: dob,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (patient) return patient.id;
  }

  if (dob) {
    const firstName = cellValue(row.firstName);
    const lastName = cellValue(row.lastName);
    if (firstName && lastName) {
      const patient = await db.patient.findFirst({
        where: {
          tenantId,
          firstName: { equals: firstName, mode: "insensitive" },
          lastName: { equals: lastName, mode: "insensitive" },
          dateOfBirth: dob,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (patient) return patient.id;
    }
  }

  return null;
}

async function resolvePrimaryIdDocument(
  row: ImportRow,
  profile: ReturnType<typeof getCountryProfile>,
) {
  for (const doc of profile.identityDocuments) {
    const val = cellValue(row[`idDoc_${doc.key}`]);
    if (val) return { type: doc.key, number: val };
  }
  const primary = profile.identityDocuments[0];
  if (!primary) return { type: null, number: null };
  return {
    type: primary.key,
    number: cellValue(row[`idDoc_${primary.key}`]) || null,
  };
}

async function resolveSecondaryIdDocument(
  row: ImportRow,
  profile: ReturnType<typeof getCountryProfile>,
) {
  const secondary = profile.identityDocuments[1];
  if (!secondary) return { type: null, number: null };
  return {
    type: secondary.key,
    number: cellValue(row[`idDoc_${secondary.key}`]) || null,
  };
}

async function createPatientRecord(
  tenantId: string,
  patientData: {
    firstName: string;
    fatherName: string | null;
    grandfatherName: string | null;
    lastName: string;
    dateOfBirth: Date;
    gender: string;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    occupation: string | null;
    bloodGroup: string | null;
    allergies: string[];
    notes: string | null;
    countryCode: string;
    idDocumentType: string | null;
    idDocumentNumber: string | null;
    id2DocumentType: string | null;
    id2DocumentNumber: string | null;
    insuranceProvider: string | null;
    insuranceNetwork: string | null;
    insuranceMemberId: string | null;
    insurancePolicyNo: string | null;
    insuranceExpiry: Date | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  },
) {
  const count = await db.patient.count({ where: { tenantId } });
  const branch = await db.branch.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { isPrimary: "desc" },
  });

  let patientId: string | undefined;
  let branchSeq: number | undefined;
  let branchCode: string | undefined;

  if (branch) {
    const generated = await generatePatientId(branch.id);
    patientId = generated.patientId;
    branchSeq = generated.patientSeq;
    branchCode = generated.branchCode;
  }

  return db.patient.create({
    data: {
      id: randomUUID(),
      tenantId,
      patientNumber: generatePatientNumber(count + 1),
      patientId: patientId ?? null,
      branchSeq: branchSeq ?? null,
      branchCode: branchCode ?? null,
      ...patientData,
    },
  });
}

async function processPatientRow(
  tenantId: string,
  row: ImportRow,
  rowNumber: number,
  mode: ImportMode,
  countryCode: string,
  customFieldDefs: CustomFieldDef[],
  rollbackIds: string[],
): Promise<ImportRowResult> {
  const warnings: string[] = [];
  const profile = getCountryProfile(countryCode);

  const mandatoryFieldErrors: ImportFieldError[] = [];
  if (!cellValue(row.firstName)) {
    mandatoryFieldErrors.push({
      field: "firstName",
      rawValue: formatRawImportValue(row.firstName),
      reason: "First Name is required",
    });
  }
  if (!cellValue(row.lastName)) {
    mandatoryFieldErrors.push({
      field: "lastName",
      rawValue: formatRawImportValue(row.lastName),
      reason: "Last/Family Name is required",
    });
  }
  if (!cellValue(row.dateOfBirth)) {
    mandatoryFieldErrors.push({
      field: "dateOfBirth",
      rawValue: formatRawImportValue(row.dateOfBirth),
      reason: "Date of Birth is required",
    });
  }
  if (!cellValue(row.gender)) {
    mandatoryFieldErrors.push({
      field: "gender",
      rawValue: formatRawImportValue(row.gender),
      reason: "Gender is required",
    });
  }
  if (!cellValue(row.phone)) {
    mandatoryFieldErrors.push({
      field: "phone",
      rawValue: formatRawImportValue(row.phone),
      reason: "Phone is required",
    });
  }

  if (mandatoryFieldErrors.length > 0) {
    return {
      rowNumber,
      status: "ERROR",
      message: mandatoryFieldErrors.map((e) => `${e.field}: ${e.reason}`).join("; "),
      fieldErrors: mandatoryFieldErrors,
    };
  }

  const dob = parseImportDateToLocalDate(row.dateOfBirth, profile.dateFormat);
  if (!dob) {
    const fieldError = importDateFieldError(
      "dateOfBirth",
      row.dateOfBirth,
      profile.dateFormat,
    );
    return {
      rowNumber,
      status: "ERROR",
      message: `${fieldError.field}: ${fieldError.reason}`,
      fieldErrors: [fieldError],
    };
  }

  for (const doc of profile.identityDocuments) {
    const val = cellValue(row[`idDoc_${doc.key}`]);
    if (val) {
      try {
        const regex = new RegExp(doc.regexStr);
        if (!regex.test(val)) {
          warnings.push(`${doc.label} format warning: expected ${doc.format}, got "${val}"`);
        }
      } catch {
        // invalid regex in profile — skip validation
      }
    }
  }

  const insuranceProv = cellValue(row.insuranceProvider);
  if (insuranceProv) {
    const validProviders = profile.insuranceProviders.map((p) => p.name);
    if (!validProviders.some((p) => p.toLowerCase() === insuranceProv.toLowerCase())) {
      warnings.push(`Unknown insurance provider: "${insuranceProv}". Will be saved as-is.`);
    }
  }

  const existingId = await findExistingPatient(tenantId, row, countryCode);

  if (existingId && mode === "CREATE_ONLY") {
    return {
      rowNumber,
      status: "SKIPPED",
      message: "Patient already exists (CREATE_ONLY mode)",
      action: "SKIPPED",
    };
  }
  if (!existingId && mode === "UPDATE_ONLY") {
    return {
      rowNumber,
      status: "SKIPPED",
      message: "Patient not found (UPDATE_ONLY mode)",
      action: "SKIPPED",
    };
  }

  const primaryId = await resolvePrimaryIdDocument(row, profile);
  const secondaryId = await resolveSecondaryIdDocument(row, profile);
  const insuranceExpiry = row.insuranceExpiry
    ? parseImportDateToLocalDate(row.insuranceExpiry, profile.dateFormat)
    : null;
  if (row.insuranceExpiry && !insuranceExpiry) {
    const fieldError = importDateFieldError(
      "insuranceExpiry",
      row.insuranceExpiry,
      profile.dateFormat,
    );
    return {
      rowNumber,
      status: "ERROR",
      message: `${fieldError.field}: ${fieldError.reason}`,
      fieldErrors: [fieldError],
    };
  }

  const allergiesRaw = cellValue(row.allergies);
  const patientData = {
    firstName: cellValue(row.firstName),
    fatherName: cellValue(row.fatherName) || null,
    grandfatherName: cellValue(row.grandfatherName) || null,
    lastName: cellValue(row.lastName),
    dateOfBirth: dob,
    gender: cellValue(row.gender).toUpperCase() || "OTHER",
    phone: cellValue(row.phone) || null,
    email: cellValue(row.email).toLowerCase() || null,
    nationality: cellValue(row.nationality) || null,
    occupation: cellValue(row.occupation) || null,
    bloodGroup: cellValue(row.bloodGroup) || null,
    allergies: allergiesRaw
      ? allergiesRaw
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [],
    notes: cellValue(row.medicalNotes) || null,
    countryCode,
    idDocumentType: primaryId.type,
    idDocumentNumber: primaryId.number,
    id2DocumentType: secondaryId.type,
    id2DocumentNumber: secondaryId.number,
    insuranceProvider: insuranceProv || null,
    insuranceNetwork: cellValue(row.insuranceNetwork) || null,
    insuranceMemberId: cellValue(row.insuranceMemberId) || null,
    insurancePolicyNo: cellValue(row.insurancePolicyNo) || null,
    insuranceExpiry,
    emergencyContactName: cellValue(row.emergencyContactName) || null,
    emergencyContactPhone: cellValue(row.emergencyContactPhone) || null,
  };

  let patientId: string;
  let action: "CREATED" | "UPDATED";

  if (existingId) {
    await db.patient.update({
      where: { id: existingId },
      data: patientData,
    });
    patientId = existingId;
    action = "UPDATED";
  } else {
    const created = await createPatientRecord(tenantId, patientData);
    patientId = created.id;
    action = "CREATED";
    rollbackIds.push(patientId);
  }

  for (const fieldDef of customFieldDefs) {
    const val = row[`custom_${fieldDef.fieldKey}`];
    if (val !== undefined && val !== null && cellValue(val) !== "") {
      await db.patientCustomFieldValue.upsert({
        where: { patientId_fieldId: { patientId, fieldId: fieldDef.id } },
        create: {
          id: randomUUID(),
          tenantId,
          patientId,
          fieldId: fieldDef.id,
          value: cellValue(val),
        },
        update: { value: cellValue(val) },
      });
    }
  }

  return {
    rowNumber,
    status: warnings.length > 0 ? "WARNING" : "SUCCESS",
    warnings: warnings.length > 0 ? warnings : undefined,
    patientId,
    action,
  };
}

export async function processImport(input: {
  tenantId: string;
  entity: ImportEntity;
  rows: ImportRow[];
  mode: ImportMode;
  fileName: string;
  importedById?: string;
}): Promise<ImportBatchResult> {
  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    select: { countryCode: true },
  });
  const countryCode = tenant?.countryCode ?? "AE";

  const customFieldDefs = await db.tenantCustomField.findMany({
    where: {
      tenantId: input.tenantId,
      entity: input.entity === "PATIENT" ? "PATIENT" : input.entity,
      isActive: true,
    },
    select: { id: true, fieldKey: true, fieldType: true },
  });

  const rollbackIds: string[] = [];
  const results: ImportRowResult[] = [];

  const batch = await db.importBatch.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      entity: input.entity,
      fileName: input.fileName,
      fileFormat: input.fileName.endsWith(".csv") ? "CSV" : "XLSX",
      totalRows: input.rows.length,
      mode: input.mode,
      countryCode,
      status: "PROCESSING",
      importedById: input.importedById ?? null,
    },
  });

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    let result: ImportRowResult;

    try {
      if (input.entity === "PATIENT") {
        result = await processPatientRow(
          input.tenantId,
          row,
          i + 4,
          input.mode,
          countryCode,
          customFieldDefs,
          rollbackIds,
        );
      } else {
        result = {
          rowNumber: i + 4,
          status: "ERROR",
          message: `${input.entity} import not yet implemented`,
        };
      }
    } catch (err) {
      result = {
        rowNumber: i + 4,
        status: "ERROR",
        message: err instanceof Error ? err.message : "Unexpected error",
      };
    }

    results.push(result);
  }

  const success = results.filter((r) => r.status === "SUCCESS").length;
  const warnings = results.filter((r) => r.status === "WARNING").length;
  const errors = results.filter((r) => r.status === "ERROR").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;

  await db.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMPLETED",
      successRows: success,
      warningRows: warnings,
      errorRows: errors,
      skippedRows: skipped,
      completedAt: new Date(),
      rollbackData:
        rollbackIds.length > 0 ? { createdIds: rollbackIds, entity: input.entity } : undefined,
      errorReport: results
        .filter((r) => r.status === "ERROR" || r.status === "WARNING")
        .map((r) => ({
          row: r.rowNumber,
          status: r.status,
          message: r.message,
          warnings: r.warnings,
          fieldErrors: r.fieldErrors,
        })),
    },
  });

  return {
    batchId: batch.id,
    total: input.rows.length,
    success,
    warnings,
    errors,
    skipped,
    results,
  };
}

type ErrorReportRow = {
  row?: number;
  rowNumber?: number;
  status: string;
  message?: string;
  warnings?: string[];
  fieldErrors?: ImportFieldError[];
};

function csvEscape(value: string): string {
  return value.replace(/"/g, '""');
}

export function buildImportErrorReportCsv(rows: ErrorReportRow[]): string {
  const lines = ["Row,Status,Field,Raw Value,Reason,Message,Warnings"];

  for (const row of rows) {
    const rowNum = row.row ?? row.rowNumber ?? "";
    const message = csvEscape(row.message ?? "");
    const warnings = csvEscape((row.warnings ?? []).join("; "));

    if (row.fieldErrors?.length) {
      for (const fieldError of row.fieldErrors) {
        lines.push(
          `${rowNum},${row.status},"${csvEscape(fieldError.field)}","${csvEscape(fieldError.rawValue)}","${csvEscape(fieldError.reason)}","${message}","${warnings}"`,
        );
      }
      continue;
    }

    lines.push(`${rowNum},${row.status},"","","","${message}","${warnings}"`);
  }

  return lines.join("\n");
}
