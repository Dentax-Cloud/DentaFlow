/**
 * Ordered Playwright walk of flag-on spine billing path (exact button labels).
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const BASE = process.env.CLICKTEST_BASE_URL ?? "http://localhost:3100";
const EMAIL = "owner@brightsmile.demo";
const PASSWORD = "BrightSmile@123";
const APPT = "seed_appt_spine_phase2";
const OUT = "tmp-phase2-clicktest";

fs.mkdirSync(OUT, { recursive: true });
const db = new PrismaClient();

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

async function clickExact(page: Page, name: string) {
  const btn = page.getByRole("button", { name, exact: true });
  await btn.first().click({ timeout: 10000 });
  await page.waitForTimeout(900);
}

async function main() {
  const logs: string[] = [];
  const report: Record<string, unknown> = { startedAt: new Date().toISOString() };

  await db.tenant.update({
    where: { id: "tenant_a" },
    data: {
      featureFlags: { ENCOUNTER_SPINE_ENABLED: true } as Prisma.InputJsonValue,
    },
  });
  // Soft-delete all prior encounters on this appt so load creates a clean open one
  await db.invoice.updateMany({
    where: {
      tenantId: "tenant_a",
      encounter: { appointmentId: APPT },
      deletedAt: null,
    },
    data: { encounterId: null, deletedAt: new Date() },
  });
  await db.encounter.updateMany({
    where: { appointmentId: APPT, tenantId: "tenant_a", deletedAt: null },
    data: { deletedAt: new Date(), closedAt: new Date(), status: "recall_scheduled" },
  });

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  try {
    await login(page);
    await page.goto(`${BASE}/clinical/encounter/${APPT}`, { waitUntil: "networkidle" });
    report.redirectedToSpine = page.url().includes("/spine");

    await page.goto(`${BASE}/clinical/encounter/${APPT}/spine`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    report.gateSummary = (await page.getByText("Gate summary").count()) > 0;

    // Advance intake → exam → gates
    await clickExact(page, "→ CHIEF COMPLAINT EXAM");
    await clickExact(page, "→ GATES");

    await page.locator("#asa").fill("II");
    await clickExact(page, "Clear risk");
    await clickExact(page, "Grant clinical consent");
    await clickExact(page, "Save insurance verification");

    await clickExact(page, "→ PROCEDURE EXECUTION");

    // Add procedure (first catalog option already selected)
    await clickExact(page, "Add line");
    // Sterilize + start + complete first line buttons
    const sterilize = page.getByRole("button", { name: /Steriliz/i });
    if ((await sterilize.count()) > 0) await sterilize.first().click();
    await page.waitForTimeout(700);
    const start = page.getByRole("button", { name: /^Start$/i });
    if ((await start.count()) > 0) await start.first().click();
    await page.waitForTimeout(700);
    const complete = page.getByRole("button", { name: /^Complete$/i });
    if ((await complete.count()) > 0) await complete.first().click();
    await page.waitForTimeout(700);

    // Material if selects present
    const logMat = page.getByRole("button", { name: /Log material/i });
    if ((await logMat.count()) > 0) {
      await logMat.first().click();
      await page.waitForTimeout(700);
    }

    await clickExact(page, "→ CLOSE OUT");
    await page.locator("#rx").fill("Ibuprofen 400mg PRN");
    await clickExact(page, "Save close-out note");
    await clickExact(page, "Schedule recall");
    await clickExact(page, "→ BILLING");

    const invoiceBtn = page.getByRole("button", { name: "Close & invoice", exact: true });
    report.invoiceEnabled = await invoiceBtn.isEnabled();
    if (await invoiceBtn.isEnabled()) {
      await invoiceBtn.click();
      await page.waitForTimeout(3500);
      await page.reload({ waitUntil: "networkidle" }).catch(() => null);
      await page.waitForTimeout(1000);
    }

    const encounters = await db.encounter.findMany({
      where: { appointmentId: APPT, tenantId: "tenant_a", deletedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, patientId: true, closedAt: true, status: true },
    });
    const invoice = await db.invoice.findFirst({
      where: {
        tenantId: "tenant_a",
        deletedAt: null,
        encounterId: { in: encounters.map((e) => e.id) },
      },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    let double = "n/a";
    const billedEncounter = encounters.find((e) => e.id === invoice?.encounterId);
    if (invoice && billedEncounter) {
      try {
        await db.invoice.create({
          data: {
            tenantId: "tenant_a",
            patientId: billedEncounter.patientId,
            encounterId: billedEncounter.id,
            invoiceNumber: `INV-DUP-UI-${Date.now()}`,
            status: "DRAFT",
            subtotal: 1,
            tax: 0,
            total: 1,
          },
        });
        double = "UNEXPECTED-ALLOWED";
      } catch (e) {
        double = `rejected:${e instanceof Error ? e.message.slice(0, 100) : "err"}`;
      }
    }

    report.encounters = encounters.map((e) => ({
      id: e.id,
      closedAt: e.closedAt?.toISOString() ?? null,
      status: e.status,
    }));
    report.invoice = invoice
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
      : null;
    report.double = double;
    report.closedVisible =
      (await page.getByText(/Closed/i).count()) > 0 ||
      (await page.getByRole("button", { name: "Close & invoice", exact: true }).isDisabled());
    report.hydrationWarnings = logs.filter((l) => /hydrat/i.test(l));
    report.console = logs.slice(0, 40);
    await page.screenshot({ path: `${OUT}/flag-on-full.png`, fullPage: true });

    if (!invoice) throw new Error("Expected spine invoice after Close & invoice");
    if (!String(double).startsWith("rejected:")) {
      throw new Error(`Expected double-invoice reject, got: ${double}`);
    }
  } catch (e) {
    report.error = e instanceof Error ? e.message : String(e);
    await page.screenshot({ path: `${OUT}/flag-on-error.png`, fullPage: true }).catch(() => null);
  } finally {
    await browser.close();
    await db.$disconnect();
    fs.writeFileSync(`${OUT}/flag-on-full.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (report.error) process.exitCode = 1;
  }
}

main();
