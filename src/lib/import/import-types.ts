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
  staffMemberId?: string;
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
