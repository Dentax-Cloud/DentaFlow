export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { processImport, type ImportMode } from "@/lib/import/import-processor";
import type { ImportEntity } from "@/lib/import/template-generator";
import { parseImportFileBuffer } from "@/lib/import/parse-upload-file";

const VALID_ENTITIES: ImportEntity[] = ["PATIENT", "INVENTORY", "STAFF", "PROCEDURE"];
const VALID_MODES: ImportMode[] = ["CREATE_ONLY", "UPDATE_ONLY", "UPSERT"];

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await requireTenantContext();
  try {
    await requirePermission(PERMISSIONS.admin.write);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const modeRaw = (formData.get("mode") as string) ?? "UPSERT";
  const entityRaw = ((formData.get("entity") as string) ?? "PATIENT").toUpperCase();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const entity = (VALID_ENTITIES.includes(entityRaw as ImportEntity)
    ? entityRaw
    : "PATIENT") as ImportEntity;
  const mode = (VALID_MODES.includes(modeRaw as ImportMode)
    ? modeRaw
    : "UPSERT") as ImportMode;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let rows: Record<string, unknown>[] = [];

  try {
    const tenant = await db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { countryCode: true, currency: true },
    });
    const countryCode = tenant?.countryCode ?? "AE";
    const currency = tenant?.currency ?? "AED";

    rows = await parseImportFileBuffer(
      buffer,
      file.name,
      ctx.tenantId,
      countryCode,
      currency,
      entity,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No data rows found. Make sure to fill data from row 4." },
      { status: 400 },
    );
  }

  if (rows.length > 5000) {
    return NextResponse.json(
      { error: "Maximum 5,000 rows per import. Split into smaller files." },
      { status: 400 },
    );
  }

  const result = await processImport({
    tenantId: ctx.tenantId,
    entity,
    rows,
    mode,
    fileName: file.name,
    importedById: ctx.staffMember?.id ?? undefined,
  });

  return NextResponse.json(result);
}
