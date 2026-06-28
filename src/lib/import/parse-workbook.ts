import ExcelJS from "exceljs";
import type { ImportEntity } from "@/lib/import/template-generator";

function isEmptyRow(values: ExcelJS.CellValue[]): boolean {
  return values.every((v) => v == null || String(v).trim() === "");
}

export async function parseImportWorkbook(
  buffer: ArrayBuffer,
  entity: ImportEntity,
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet(entity) ?? workbook.worksheets[0];
  if (!sheet) return [];

  const columnKeys =
    sheet.columns
      ?.map((col) => (typeof col.key === "string" ? col.key : undefined))
      .filter((key): key is string => Boolean(key)) ?? [];

  const rows: Record<string, unknown>[] = [];

  for (let rowNum = 4; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];

    if (isEmptyRow(values as ExcelJS.CellValue[])) continue;

    const record: Record<string, unknown> = {};

    if (columnKeys.length > 0) {
      columnKeys.forEach((key, index) => {
        record[key] = row.getCell(index + 1).value ?? "";
      });
    } else {
      const headerRow = sheet.getRow(2);
      headerRow.eachCell((cell, colNumber) => {
        const header = String(cell.value ?? "")
          .replace(/\s*\*$/, "")
          .trim();
        if (!header) return;
        const key = header
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
          .replace(/^./, (c) => c.toLowerCase());
        record[key] = row.getCell(colNumber).value ?? "";
      });
    }

    rows.push(record);
  }

  return rows;
}
