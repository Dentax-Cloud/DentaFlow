/**
 * Module 6 Phase 2 live verification (Playwright).
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const BASE = process.env.CLICKTEST_BASE_URL ?? "http://localhost:3100";
const EMAIL = "owner@brightsmile.demo";
const PASSWORD = "BrightSmile@123";
const FLAG_OFF_APPT = "seed_appt_flagoff_phase2";
const SPINE_APPT = "seed_appt_spine_phase2";
const OUT = "tmp-phase2-clicktest";

fs.mkdirSync(OUT, { recursive: true });
const db = new PrismaClient();

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30000,
  });
  if (page.url().includes("select")) {
    await page.getByText(/BrightSmile/i).first().click();
    await page.waitForTimeout(1500);
  }
}

function attachConsole(page: Page, bucket: string[]) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      bucket.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => bucket.push(`[pageerror] ${err.message}`));
}

async function clickIf(page: Page, name: RegExp) {
  const btn = page.getByRole("button", { name });
  if ((await btn.count()) > 0) {
    await btn.first().click();
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function runFlagOff(page: Page, report: Record<string, unknown>) {
  const logs: string[] = [];
  attachConsole(page, logs);

  await page.goto(`${BASE}/clinical/encounter/${FLAG_OFF_APPT}/spine`, {
    waitUntil: "networkidle",
  });
  const spineUrl = page.url();
  const spineUnreachable = !spineUrl.includes("/spine");

  await page.goto(`${BASE}/clinical/encounter/${FLAG_OFF_APPT}`, { waitUntil: "networkidle" });
  const legacyUrl = page.url();
  const legacyOk =
    legacyUrl.includes(`/clinical/encounter/${FLAG_OFF_APPT}`) && !legacyUrl.includes("/spine");

  let finalizeNote = "no-finalize-button";
  const completeBtn = page.getByRole("button", {
    name: /Complete.*Invoice|Finalize|Complete & Create/i,
  });
  if ((await completeBtn.count()) > 0) {
    page.once("dialog", async (d) => d.accept());
    await completeBtn.first().click();
    await page.waitForTimeout(3000);
    finalizeNote = "clicked-finalize";
  }

  const inv = await db.invoice.findFirst({
    where: { tenantId: "tenant_a", deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  report.flagOff = {
    spineUrl,
    spineUnreachable,
    legacyUrl,
    legacyOk,
    finalizeNote,
    invoice: inv
      ? {
          number: inv.invoiceNumber,
          total: inv.total.toString(),
          items: inv.items.map((i) => ({
            description: i.description,
            total: i.total.toString(),
          })),
        }
      : null,
    console: logs.slice(0, 30),
  };
  await page.screenshot({ path: `${OUT}/flag-off.png`, fullPage: true });
}

async function enableSpineFlag() {
  const tenant = await db.tenant.findFirst({ where: { id: "tenant_a" } });
  const flags =
    tenant?.featureFlags &&
    typeof tenant.featureFlags === "object" &&
    !Array.isArray(tenant.featureFlags)
      ? { ...(tenant.featureFlags as Record<string, unknown>) }
      : {};
  flags.ENCOUNTER_SPINE_ENABLED = true;
  await db.tenant.update({
    where: { id: "tenant_a" },
    data: { featureFlags: flags as Prisma.InputJsonValue },
  });
}

async function runFlagOn(page: Page, report: Record<string, unknown>) {
  const logs: string[] = [];
  attachConsole(page, logs);

  await page.goto(`${BASE}/clinical/encounter/${SPINE_APPT}`, { waitUntil: "networkidle" });
  const afterLegacy = page.url();
  const redirectedToSpine = afterLegacy.includes("/spine");

  await page.goto(`${BASE}/clinical/encounter/${SPINE_APPT}/spine`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/spine-initial.png`, fullPage: true });

  const asa = page.getByLabel(/ASA/i);
  if ((await asa.count()) > 0) await asa.fill("II");
  await clickIf(page, /Clear risk|Save risk|Record risk/i);
  await clickIf(page, /Grant consent|Record consent/i);
  await clickIf(page, /Save insurance|Verify insurance|Record insurance/i);
  await clickIf(page, /chief complaint|Advance to|Next stage|exam/i);
  await clickIf(page, /gates|Advance/i);
  await clickIf(page, /procedure execution|Advance.*procedure|Enter procedure/i);

  const selects = page.locator("select");
  if ((await selects.count()) > 0) {
    await selects.first().selectOption({ index: 1 }).catch(() => null);
  }
  await clickIf(page, /Add procedure|Add line/i);
  await clickIf(page, /Steriliz/i);
  await clickIf(page, /Start|In progress/i);
  await clickIf(page, /Complete line|Mark completed|Complete$/i);
  await clickIf(page, /Log material|Add material/i);
  await clickIf(page, /Close out|close_out/i);
  await clickIf(page, /Billing|billing/i);
  const invoiceBtn = page.getByRole("button", {
    name: /Close.*[Ii]nvoice|Generate invoice|Create invoice/i,
  });
  let invoiceClick = "absent";
  if ((await invoiceBtn.count()) > 0) {
    if (await invoiceBtn.first().isEnabled()) {
      await invoiceBtn.first().click();
      await page.waitForTimeout(2500);
      invoiceClick = "clicked";
    } else {
      invoiceClick = "disabled";
    }
  }

  const firstInvoice = await db.invoice.findFirst({
    where: { tenantId: "tenant_a", encounterId: { not: null }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  let doubleGuard = "not-attempted";
  if (invoiceClick === "clicked" && (await invoiceBtn.count()) > 0) {
    if (await invoiceBtn.first().isEnabled()) {
      await invoiceBtn.first().click();
      await page.waitForTimeout(1500);
    }
    const errText = await page.locator("text=/already has an invoice|already invoiced/i").count();
    doubleGuard = errText > 0 ? "ui-rejected" : "clicked-again";
  }

  const gateSummaryVisible = (await page.getByText(/Gate summary/i).count()) > 0;
  const spineHeading = (await page.getByText(/Encounter spine|Module 6|Procedure/i).count()) > 0;

  const encounter = await db.encounter.findFirst({
    where: { appointmentId: SPINE_APPT, tenantId: "tenant_a", deletedAt: null },
    orderBy: { startedAt: "desc" },
  });
  let dbDouble = "no-encounter";
  if (encounter) {
    try {
      await db.invoice.create({
        data: {
          tenantId: "tenant_a",
          patientId: encounter.patientId,
          encounterId: encounter.id,
          invoiceNumber: `INV-DUP-TEST-${Date.now()}`,
          status: "DRAFT",
          subtotal: 1,
          tax: 0,
          total: 1,
        },
      });
      dbDouble = "UNEXPECTED-ALLOWED";
    } catch (e) {
      dbDouble = `rejected:${e instanceof Error ? e.message.slice(0, 160) : "error"}`;
    }
  }

  report.flagOn = {
    redirectedToSpine,
    afterLegacy,
    spineUrl: page.url(),
    gateSummaryVisible,
    spineHeading,
    invoiceClick,
    invoice: firstInvoice
      ? {
          number: firstInvoice.invoiceNumber,
          total: firstInvoice.total.toString(),
          tax: firstInvoice.tax.toString(),
          encounterId: firstInvoice.encounterId,
          items: firstInvoice.items.map((i) => ({
            description: i.description,
            total: i.total.toString(),
            code: i.procedureCode,
          })),
        }
      : null,
    doubleGuard,
    dbDouble,
    hydrationWarnings: logs.filter((l) => /hydrat/i.test(l)),
    console: logs.slice(0, 40),
  };
  await page.screenshot({ path: `${OUT}/spine-final.png`, fullPage: true });
}

async function main() {
  const report: Record<string, unknown> = {
    base: BASE,
    startedAt: new Date().toISOString(),
  };
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const page = await browser.newPage();
  try {
    await login(page);
    report.loginUrl = page.url();
    await runFlagOff(page, report);
    await enableSpineFlag();
    report.spineFlagEnabled = true;
    await runFlagOn(page, report);
  } catch (e) {
    report.error = e instanceof Error ? e.message : String(e);
    await page.screenshot({ path: `${OUT}/error.png`, fullPage: true }).catch(() => null);
  } finally {
    await browser.close();
    await db.$disconnect();
    fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}

main();
