import { db } from "@/lib/db";
import type { Tenant } from "@prisma/client";

/** Seed industry-standard defaults for a newly provisioned clinic. */
export async function seedTenantDefaults(tenant: Tenant, currency = "AED") {
  await Promise.all([
    seedProcedureCatalog(tenant.id),
    seedInventoryItems(tenant.id),
    seedClinicSettings(tenant.id, currency),
  ]);
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

async function seedInventoryItems(tenantId: string) {
  await db.inventoryItem.createMany({
    data: [
      {
        tenantId,
        sku: "INV-GLOVES",
        name: "Disposable Gloves (Box)",
        unit: "BOX",
        quantity: 10,
        reorderLevel: 3,
        cost: 25,
      },
      {
        tenantId,
        sku: "INV-MASKS",
        name: "Dental Masks (Box)",
        unit: "BOX",
        quantity: 10,
        reorderLevel: 3,
        cost: 35,
      },
      {
        tenantId,
        sku: "INV-COMPOSITE",
        name: "Composite Resin (Syringe)",
        unit: "PCS",
        quantity: 20,
        reorderLevel: 5,
        cost: 45,
      },
      {
        tenantId,
        sku: "INV-ANESTHETIC",
        name: "Local Anesthetic (Carpule)",
        unit: "PCS",
        quantity: 50,
        reorderLevel: 10,
        cost: 8,
      },
      {
        tenantId,
        sku: "INV-FLOSS",
        name: "Dental Floss (Pack)",
        unit: "PACK",
        quantity: 30,
        reorderLevel: 10,
        cost: 5,
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
