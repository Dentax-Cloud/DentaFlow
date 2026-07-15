/**
 * Flag-off: old chairside finalize still produces an invoice.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  getOrCreateActiveChairsideSession,
} from "../src/lib/clinical/start-chairside-session";
import { finalizeChairsideSessionRecord } from "../src/lib/clinical/chairside-lifecycle";
import { db as appDb } from "../src/lib/db";

const db = new PrismaClient();
const OUT = "tmp-phase2-clicktest";
const APPT = "seed_appt_flagoff_phase2";
const TENANT = "tenant_a";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await db.tenant.update({
    where: { id: TENANT },
    data: { featureFlags: {} },
  });

  const appt = await db.appointment.findFirstOrThrow({
    where: { id: APPT, tenantId: TENANT },
  });
  const staff = await db.staffMember.findFirst({
    where: { tenantId: TENANT, email: "owner@brightsmile.demo" },
  });

  const session = await getOrCreateActiveChairsideSession({
    tenantId: TENANT,
    staffMemberId: staff?.id ?? null,
    patientId: appt.patientId!,
    appointmentId: APPT,
    skipConsentCheck: true,
  });

  const catalog = await db.procedureCatalog.findFirstOrThrow({
    where: { tenantId: TENANT, code: "D2391" },
  });

  await appDb.chairsideEntry.create({
    data: {
      tenantId: TENANT,
      sessionId: session.id,
      procedureCode: catalog.code,
      procedureName: catalog.name,
      unitPrice: catalog.price,
      quantity: 1,
      includeInInvoice: true,
      toothNumber: 16,
    },
  });

  const result = await finalizeChairsideSessionRecord({
    sessionId: session.id,
    tenantId: TENANT,
    staffMemberId: staff?.id ?? null,
    closedReason: "manual_finalize",
  });

  const invoice = await db.invoice.findFirst({
    where: { tenantId: TENANT, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const report = {
    flag: "OFF",
    sessionId: session.id,
    finalize: result,
    invoice: invoice
      ? {
          number: invoice.invoiceNumber,
          total: invoice.total.toString(),
          tax: invoice.tax.toString(),
          items: invoice.items.map((i) => ({
            description: i.description,
            total: i.total.toString(),
            code: i.procedureCode,
          })),
        }
      : null,
  };
  fs.writeFileSync(`${OUT}/flag-off-finalize.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
