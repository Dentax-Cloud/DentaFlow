"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import {
  processImport,
  type ImportBatchResult,
  type ImportMode,
} from "@/lib/import/import-processor";
import type { ImportEntity } from "@/lib/import/template-generator";

export async function runDataImport(input: {
  entity: ImportEntity;
  rows: Record<string, unknown>[];
  mode: ImportMode;
  fileName: string;
}): Promise<ImportBatchResult> {
  const ctx = await requireTenantContext();

  return processImport({
    tenantId: ctx.tenantId,
    entity: input.entity,
    rows: input.rows,
    mode: input.mode,
    fileName: input.fileName,
    importedById: ctx.staffMember?.id ?? undefined,
  });
}
