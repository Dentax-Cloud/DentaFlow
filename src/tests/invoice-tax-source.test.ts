import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("invoice tax source-of-truth isolation", () => {
  it("live treatment-plan invoicing uses calculateInvoiceTaxAndLines + insurance split", () => {
    const src = readFileSync(
      resolve("src/app/(dashboard)/features/clinical/treatment-plan-actions.ts"),
      "utf8",
    );
    const fnIdx = src.indexOf("export async function generateInvoiceFromPlan");
    expect(fnIdx).toBeGreaterThanOrEqual(0);
    const slice = src.slice(fnIdx, fnIdx + 3500);
    expect(slice.includes("calculateInvoiceTaxAndLines")).toBe(true);
    expect(slice.includes("calculateInsuranceSplit")).toBe(true);
    expect(slice.includes("resolveInvoicePayerType")).toBe(true);
    expect(slice.includes("settings?.taxRate")).toBe(false);
  });

  it("shared creator sets payerType from insurance split", () => {
    const src = readFileSync(resolve("src/lib/billing/invoice-from-items.ts"), "utf8");
    expect(src.includes("resolveInvoicePayerType")).toBe(true);
    expect(src.includes("payerType")).toBe(true);
    expect(src.includes("calculateInsuranceSplit")).toBe(true);
  });

  it("updateClinicSettings no longer writes Settings.taxRate", () => {
    const schema = readFileSync(
      resolve("src/app/(dashboard)/features/admin/schemas.ts"),
      "utf8",
    );
    const action = readFileSync(
      resolve("src/app/(dashboard)/features/admin/actions.ts"),
      "utf8",
    );
    const form = readFileSync(
      resolve("src/app/(dashboard)/admin/components/clinic-settings-form.tsx"),
      "utf8",
    );

    const schemaSlice = schema.slice(
      schema.indexOf("updateClinicSettingsSchema"),
      schema.indexOf("updateClinicSettingsSchema") + 500,
    );
    expect(schemaSlice.includes("taxRate")).toBe(false);

    const upsertIdx = action.indexOf("export const updateClinicSettings");
    const actionSlice = action.slice(upsertIdx, upsertIdx + 1200);
    expect(actionSlice.includes("taxRate: input.taxRate")).toBe(false);

    expect(form.includes("tenantTax")).toBe(true);
    expect(form.includes("Determined by your registered country")).toBe(true);
  });
});
