import { db } from "@/lib/db";
import type { Tenant } from "@prisma/client";
import { PLATFORM_DEFAULT_TEMPLATES } from "@/lib/clinical/default-templates";
import {
  seedStandardTrayInventory,
  seedStandardTrayTemplates,
} from "@/lib/chair-setup/seed-tray-templates";

/** Seed industry-standard defaults for a newly provisioned clinic. */
export async function seedTenantDefaults(tenant: Tenant, currency = "AED") {
  await Promise.all([
    seedProcedureCatalog(tenant.id),
    seedClinicSettings(tenant.id, currency),
    seedClinicalTemplates(tenant.id),
  ]);

  await seedStandardTrayInventory(tenant.id);
  await seedStandardTrayTemplates(tenant.id);
}

async function seedProcedureCatalog(tenantId: string) {
  await db.procedureCatalog.createMany({
    data: [
      {
        tenantId,
        code: "D0120",
        name: "Periodic Oral Evaluation",
        category: "DIAGNOSTIC",
        duration: 30,
        price: 150,
        costPrice: 50,
        isActive: true,
      },
      {
        tenantId,
        code: "D0150",
        name: "Comprehensive Oral Evaluation",
        category: "DIAGNOSTIC",
        duration: 45,
        price: 200,
        costPrice: 70,
        isActive: true,
      },
      {
        tenantId,
        code: "D0210",
        name: "Full Mouth X-Ray",
        category: "DIAGNOSTIC",
        duration: 20,
        price: 300,
        costPrice: 100,
        isActive: true,
      },
      {
        tenantId,
        code: "D1110",
        name: "Dental Cleaning (Adult)",
        category: "PREVENTIVE",
        duration: 45,
        price: 250,
        costPrice: 80,
        isActive: true,
      },
      {
        tenantId,
        code: "D2140",
        name: "Amalgam Filling (1 surface)",
        category: "RESTORATIVE",
        duration: 45,
        price: 350,
        costPrice: 120,
        isActive: true,
      },
      {
        tenantId,
        code: "D2740",
        name: "Porcelain Crown",
        category: "RESTORATIVE",
        duration: 90,
        price: 2500,
        costPrice: 800,
        isActive: true,
      },
      {
        tenantId,
        code: "D3310",
        name: "Root Canal (anterior)",
        category: "ENDODONTIC",
        duration: 60,
        price: 1500,
        costPrice: 500,
        isActive: true,
      },
      {
        tenantId,
        code: "D4341",
        name: "Periodontal Scaling",
        category: "PERIODONTIC",
        duration: 60,
        price: 800,
        costPrice: 250,
        isActive: true,
      },
      {
        tenantId,
        code: "D7140",
        name: "Simple Extraction",
        category: "ORAL_SURGERY",
        duration: 30,
        price: 400,
        costPrice: 150,
        isActive: true,
      },
      {
        tenantId,
        code: "D9930",
        name: "Teeth Whitening",
        category: "COSMETIC",
        duration: 60,
        price: 1200,
        costPrice: 400,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });
}

async function seedClinicSettings(tenantId: string, currency: string) {
  await db.settings.upsert({
    where: { tenantId },
    update: {
      appointmentDuration: 30,
      reminderHoursBefore: 24,
      currency,
      taxRate: currency === "AED" ? 5 : 0,
    },
    create: {
      tenantId,
      appointmentDuration: 30,
      reminderHoursBefore: 24,
      currency,
      taxRate: currency === "AED" ? 5 : 0,
    },
  });
}

async function seedClinicalTemplates(tenantId: string) {
  const existing = await db.clinicalTemplate.count({ where: { tenantId } });
  if (existing > 0) return;

  await db.clinicalTemplate.createMany({
    data: PLATFORM_DEFAULT_TEMPLATES.map((t) => ({
      tenantId,
      name: t.name,
      type: t.type,
      content: t.content,
      isDefault: t.isDefault ?? false,
      isActive: true,
    })),
  });
}
