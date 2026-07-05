export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getCountryProfile } from "@/lib/countries";
import { db } from "@/lib/db";
import DataImportClient from "./data-import-client";

export default async function DataImportPage() {
  const ctx = await requireRouteAccess("admin", "read");

  const [tenant, customFields, importHistory] = await Promise.all([
    db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { countryCode: true, currency: true, name: true },
    }),
    db.tenantCustomField.findMany({
      where: { tenantId: ctx.tenantId, entity: "PATIENT", isActive: true },
      select: { fieldKey: true, fieldLabel: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.importBatch.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        entity: true,
        fileName: true,
        totalRows: true,
        successRows: true,
        warningRows: true,
        errorRows: true,
        skippedRows: true,
        mode: true,
        status: true,
        canRollback: true,
        rolledBackAt: true,
        createdAt: true,
        completedAt: true,
        errorReport: true,
      },
    }),
  ]);

  const profile = getCountryProfile(tenant?.countryCode ?? "AE");

  return (
    <DataImportClient
      clinicName={tenant?.name ?? "Clinic"}
      countryCode={tenant?.countryCode ?? "AE"}
      countryName={profile.name}
      countryFlag={profile.flag}
      dateFormat={profile.dateFormat}
      currency={tenant?.currency ?? "AED"}
      dialCode={profile.dialCode}
      phoneExample={profile.phoneExample}
      identityDocs={profile.identityDocuments.map((d) => ({
        label: d.label,
        format: d.format,
        example: d.example,
        mandatory: d.mandatory,
      }))}
      insuranceProviders={profile.insuranceProviders.map((p) => p.name)}
      customFields={customFields}
      importHistory={importHistory.map((h) => ({
        id: h.id,
        entity: h.entity,
        fileName: h.fileName,
        totalRows: h.totalRows,
        successRows: h.successRows,
        warningRows: h.warningRows,
        errorRows: h.errorRows,
        skippedRows: h.skippedRows,
        mode: h.mode,
        status: h.status,
        canRollback: h.canRollback,
        rolledBackAt: h.rolledBackAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
        completedAt: h.completedAt?.toISOString() ?? null,
        errorReport: h.errorReport,
      }))}
    />
  );
}
