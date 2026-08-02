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
  const btn = page.getByRole("button", { name, exact: true }).first();
  // Spine actions set client `pending`; buttons use disabled={!canWrite || pending}.
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(
    (el) => el instanceof HTMLButtonElement && !el.disabled,
    await btn.elementHandle(),
    { timeout: 30000 },
  );
  await btn.click({ timeout: 10000 });
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
    report.threeZoneLayout =
      (await page.locator("[data-stage]").count()) >= 4 &&
      (await page.getByRole("navigation").count()) +
        (await page.getByLabel(/Encounter stages|Billing preview|Running total/i).count()) >
        0;
    report.gateSummary = (await page.getByText("Gate summary").count()) > 0;
    report.hydrationWarnings = logs.filter((l) => /hydrat/i.test(l)).length;

    // Advance intake → exam → gates (status strip is outside collapsible cards)
    await clickExact(page, "→ CHIEF COMPLAINT EXAM");
    await page.getByPlaceholder("Chief complaint").fill("Sensitivity in upper right molar");
    await page.getByPlaceholder("Findings").fill("Tenderness on percussion");
    await page.getByPlaceholder("Provisional diagnosis").fill("Reversible pulpitis");
    await clickExact(page, "Mark exam complete");
    await clickExact(page, "→ GATES");

    // Phase 2b: expand Gate summary stage card if collapsed
    const gateCardToggle = page.locator('[data-stage="gates"] button').first();
    if ((await gateCardToggle.getAttribute("aria-expanded")) === "false") {
      await gateCardToggle.click();
      await page.waitForTimeout(300);
    }

    await page.locator("#asa").fill("II");
    await clickExact(page, "Clear risk");
    await clickExact(page, "Grant clinical consent");
    await clickExact(page, "Save insurance verification");

    await clickExact(page, "→ PROCEDURE EXECUTION");

    const procToggle = page.locator('[data-stage="procedures"] button').first();
    if ((await procToggle.getAttribute("aria-expanded")) === "false") {
      await procToggle.click();
      await page.waitForTimeout(300);
    }

    // Pending price preview: select procedure without adding
    const procSelect = page.locator("#proc");
    await procSelect.selectOption({ index: 1 });
    await page.waitForTimeout(400);
    report.pendingProcedureVisible =
      (await page.locator("[data-pending-prices]").getByText(/Pending · procedure/i).count()) > 0;
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: `${OUT}/phase2b-pending-procedure.png`,
      fullPage: false,
    });

    // Add procedure (selected catalog option)
    await clickExact(page, "Add line");
    await page.waitForTimeout(1500);
    await page
      .locator('[data-stage="procedures"]')
      .getByText(/PLANNED|IN PROGRESS|COMPLETED/i)
      .first()
      .waitFor({ timeout: 15000 });

    const procCard = page.locator('[data-stage="procedures"]');
    // Sterilize + start + complete first line buttons
    const sterilize = procCard.getByRole("button", { name: /^Sterilize$/i });
    if ((await sterilize.count()) > 0) {
      await sterilize.first().click();
      await page.waitForTimeout(1500);
    }
    const start = procCard.getByRole("button", { name: /^Start$/i });
    if ((await start.count()) > 0) {
      await start.first().click();
      await page.waitForTimeout(1500);
    }
    const complete = procCard.getByRole("button", { name: /^Complete$/i });
    if ((await complete.count()) > 0) {
      await complete.first().click();
      await page.waitForTimeout(1500);
    }
    await procCard.getByText(/COMPLETED/i).first().waitFor({ timeout: 15000 });

    // Pending material preview before log (material selects live in billing drawer / materials slot)
    const materialItemSelect = page
      .locator("select")
      .filter({ has: page.locator('option', { hasText: /Select material/i }) })
      .first();
    const qtyInput = page.locator('input[placeholder="Qty"]').first();
    const materialOptionCount =
      (await materialItemSelect.count()) > 0
        ? await materialItemSelect.locator("option").count()
        : 0;
    report.materialOptionCount = materialOptionCount;
    if (
      materialOptionCount > 1 &&
      (await materialItemSelect.count()) > 0 &&
      (await qtyInput.count()) > 0
    ) {
      await materialItemSelect.selectOption({ index: 1 });
      await qtyInput.fill("2");
      await page.waitForTimeout(300);
      report.pendingMaterialVisible =
        (await page.locator("[data-pending-prices]").getByText(/Pending · material/i).count()) > 0;
      await page.screenshot({
        path: `${OUT}/phase2b-pending-material.png`,
        fullPage: false,
      });
      await qtyInput.fill("3");
      await page.waitForTimeout(200);
      report.pendingMaterialQtyLive =
        (await page.locator("[data-pending-prices]").getByText(/× 3/i).count()) > 0;
      // Clear selection — pending row should vanish client-side
      await materialItemSelect.selectOption({ value: "" });
      await page.waitForTimeout(200);
      report.pendingClearsWithoutRoundTrip =
        (await page.locator("[data-pending-prices]").getByText(/Pending · material/i).count()) ===
        0;
      // Re-select for log
      await materialItemSelect.selectOption({ index: 1 });
      await qtyInput.fill("1");
    } else {
      report.pendingMaterialVisible = false;
      report.pendingMaterialSkipped = "no inventory options in material select";
    }

    // Material if selects present
    const logMat = page.getByRole("button", { name: /Log material/i });
    if ((await logMat.count()) > 0) {
      await logMat.first().click();
      await page.waitForTimeout(700);
    }

    await clickExact(page, "→ CLOSE OUT");
    const closeToggle = page.locator('[data-stage="close_out"] button').first();
    if ((await closeToggle.getAttribute("aria-expanded")) === "false") {
      await closeToggle.click();
      await page.waitForTimeout(300);
    }
    await page.locator("#rx").fill("Ibuprofen 400mg PRN");
    await clickExact(page, "Save close-out note");
    await clickExact(page, "Schedule recall");
    await clickExact(page, "→ BILLING");

    const billToggle = page.locator('[data-stage="billing"] button').first();
    if ((await billToggle.getAttribute("aria-expanded")) === "false") {
      await billToggle.click();
      await page.waitForTimeout(300);
    }

    // Layout evidence screenshots (Phase 2b)
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: `${OUT}/phase2b-desktop-three-zone.png`, fullPage: false });
    const collapseNav = page.getByRole("button", { name: /Collapse stage navigation/i });
    if ((await collapseNav.count()) > 0) {
      await collapseNav.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/phase2b-nav-collapsed.png`, fullPage: false });
      await page.getByRole("button", { name: /Expand stage navigation/i }).click();
    }
    const odontoTool = page.getByRole("button", { name: /^Odontogram$/i });
    if ((await odontoTool.count()) > 0) {
      await odontoTool.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/phase2b-odontogram-overlay.png`, fullPage: false });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: `${OUT}/phase2b-billing-drawer.png`, fullPage: false });

    const invoiceBtn = page
      .locator('[data-stage="billing"]')
      .getByRole("button", { name: "Close & invoice", exact: true });
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
    // PR #7 interaction: billing drawer / invoice must carry payerType + tax fields
    report.invoicePayerType = invoice
      ? ((invoice as { payerType?: string | null }).payerType ?? null)
      : null;
    report.invoiceTax = invoice ? invoice.tax.toString() : null;

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
          payerType: (invoice as { payerType?: string | null }).payerType ?? null,
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
