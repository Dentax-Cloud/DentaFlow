"use server";

import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { checkPatientLimit, requireActiveSubscription } from "@/lib/features/gate";
import { tenantWhere } from "@/lib/tenant/scoped";
import { generatePatientNumber } from "@/lib/utils";
import { splitList } from "@/lib/import/csv";
import { AuditAction } from "@prisma/client";
import { getStaffActor } from "@/lib/tenant/context";
import {
  importInventorySchema,
  importPatientsSchema,
  importProceduresSchema,
} from "./schemas";
import type { ImportResult } from "./import-types";

function emptyResult(): ImportResult {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

export const importPatients = createAction({
  schema: importPatientsSchema,
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    await requireActiveSubscription();

    const result = emptyResult();
    let sequence = await db.patient.count({ where: { tenantId: ctx.tenant.id } });

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const rowNum = i + 2;

      try {
        const allergies = splitList(row.allergies);
        const medications = splitList(row.medications);
        const patientNumber =
          row.patient_number?.trim() || generatePatientNumber(++sequence);

        const existing = await db.patient.findFirst({
          where: {
            tenantId: ctx.tenant.id,
            deletedAt: null,
            OR: [
              ...(row.patient_number
                ? [{ patientNumber: row.patient_number.trim() }]
                : []),
              ...(row.email ? [{ email: row.email.trim() }] : []),
            ],
          },
        });

        const data = {
          firstName: row.first_name.trim(),
          lastName: row.last_name.trim(),
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
          gender: row.gender?.trim() || null,
          address: row.address?.trim() || null,
          allergies,
          medications,
          notes: row.notes?.trim() || null,
        };

        if (existing) {
          if (input.duplicateMode === "skip") {
            result.skipped++;
            continue;
          }
          await db.patient.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          if (!ctx.isSuperAdmin) {
            await checkPatientLimit(ctx.tenant.id);
          }
          await db.patient.create({
            data: {
              tenantId: ctx.tenant.id,
              patientNumber,
              ...data,
            },
          });
          result.created++;
        }
      } catch (err) {
        result.errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Invalid row",
        });
      }
    }

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "PatientImport",
      metadata: result,
    });

    return result;
  },
});

export const importInventoryItems = createAction({
  schema: importInventorySchema,
  permission: () => requirePermission(PERMISSIONS.inventory.write),
  handler: async (input, ctx) => {
    const result = emptyResult();

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const rowNum = i + 2;

      try {
        const sku = row.sku.trim();
        const existing = await db.inventoryItem.findFirst({
          where: tenantWhere(ctx.tenant.id, { sku, deletedAt: null }),
        });

        const data = {
          name: row.name.trim(),
          category: row.category?.trim() || null,
          unit: row.unit?.trim() || "unit",
          quantity: row.quantity ? parseInt(row.quantity, 10) || 0 : 0,
          reorderLevel: row.reorder_level ? parseInt(row.reorder_level, 10) || 10 : 10,
          cost: row.cost ? parseFloat(row.cost) : null,
          batchNumber: row.batch_number?.trim() || null,
          expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
        };

        if (existing) {
          if (input.duplicateMode === "skip") {
            result.skipped++;
            continue;
          }
          await db.inventoryItem.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          await db.inventoryItem.create({
            data: { tenantId: ctx.tenant.id, sku, ...data },
          });
          result.created++;
        }
      } catch (err) {
        result.errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Invalid row",
        });
      }
    }

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "InventoryImport",
      metadata: result,
    });

    return result;
  },
});

export const importProcedures = createAction({
  schema: importProceduresSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const result = emptyResult();

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const rowNum = i + 2;

      try {
        const code = row.code.trim().toUpperCase();
        const price = parseFloat(row.price);
        if (Number.isNaN(price)) throw new Error("Invalid price");

        const existing = await db.procedureCatalog.findFirst({
          where: { tenantId: ctx.tenant.id, code },
        });

        const data = {
          name: row.name.trim(),
          description: row.description?.trim() || null,
          category: row.category?.trim() || null,
          price,
          duration: row.duration_minutes ? parseInt(row.duration_minutes, 10) : null,
          isActive: true,
        };

        if (existing) {
          if (input.duplicateMode === "skip") {
            result.skipped++;
            continue;
          }
          await db.procedureCatalog.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          await db.procedureCatalog.create({
            data: { tenantId: ctx.tenant.id, code, ...data },
          });
          result.created++;
        }
      } catch (err) {
        result.errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Invalid row",
        });
      }
    }

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "ProcedureImport",
      metadata: result,
    });

    return result;
  },
});
