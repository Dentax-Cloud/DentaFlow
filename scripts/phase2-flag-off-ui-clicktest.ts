/**
 * Flag-OFF Playwright verification: classic chairside finalize + spine unreachable.
 * Requires ENCOUNTER_SPINE_ENABLED env NOT equal to "true", and tenant.featureFlags empty.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const BASE = process.env.CLICKTEST_BASE_URL ?? "http://localhost:3100";
const EMAIL = "owner@brightsmile.demo";
const PASSWORD = "BrightSmile@123";
const APPT = "seed_appt_flagoff_phase2";
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

async function main() {
  const logs: string[] = [];
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    envENCOUNTER_SPINE_ENABLED: process.env.ENCOUNTER_SPINE_ENABLED ?? null,
  };

  // Flag genuinely OFF in DB
  await db.tenant.update({
    where: { id: "tenant_a" },
    data: { featureFlags: {} as Prisma.InputJsonValue },
  });
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: "tenant_a" },
    select: { featureFlags: true },
  });
  report.runtimeTenantFeatureFlags = tenant.featureFlags;


  // Soft-delete prior invoices and free unique invoiceRef so chairside finalize
  // is not blocked by a spine invoice created earlier in the same DB.
  const priorInvoices = await db.invoice.findMany({
    where: { tenantId: "tenant_a", deletedAt: null },
    select: { id: true },
  });
  for (const inv of priorInvoices) {
    await db.invoice.update({
      where: { id: inv.id },
      data: {
        deletedAt: new Date(),
        encounterId: null,
        invoiceRef: `deleted-${inv.id}`,
        invoiceNumber: `DEL-${inv.id.slice(0, 12)}`,
      },
    });
  }
  // Reset appointment + soft prior open chairside sessions for clean run
  await db.appointment.updateMany({
    where: { id: APPT, tenantId: "tenant_a" },
    data: { status: "CONFIRMED", deletedAt: null },
  });
  await db.chairsideSession.updateMany({
    where: { appointmentId: APPT, tenantId: "tenant_a", status: "ACTIVE" },
    data: { status: "ABANDONED", finalizedAt: new Date(), closedReason: "verification_reset" },
  });

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  try {
    await login(page);

    // Prove spine routes unreachable when flag off
    await page.goto(`${BASE}/clinical/encounter/${APPT}/spine`, { waitUntil: "networkidle" });
    report.spineUrl = page.url();
    report.spineUnreachable = !page.url().includes("/spine");

    await page.goto(`${BASE}/clinical/encounter/${APPT}/timeline`, {
      waitUntil: "networkidle",
    });
    report.timelineUrl = page.url();
    report.timelineRedirectedAway = !page.url().includes("/timeline");

    // Phase 3a: chair-prep is spine-flag-gated
    await page.goto(`${BASE}/clinical/chair-prep`, { waitUntil: "networkidle" });
    report.chairPrepUrl = page.url();
    report.chairPrepUnreachable = !page.url().includes("/chair-prep");

    // Classic encounter workspace (chairside chart lives here when flag off)
    await page.goto(`${BASE}/clinical/encounter/${APPT}`, { waitUntil: "networkidle" });
    report.legacyUrl = page.url();
    report.legacyOk =
      page.url().includes(`/clinical/encounter/${APPT}`) && !page.url().includes("/spine");

    // Add procedure via search
    const search = page.getByPlaceholder(/Search by code or name/i);
    await search.waitFor({ timeout: 15000 });
    await search.fill("D2391");
    await page.waitForTimeout(600);
    const procBtn = page.locator("button").filter({ hasText: /D2391|Resin composite/i }).first();
    await procBtn.click({ timeout: 10000 });
    await page.waitForTimeout(1200);

    const beforeCount = await db.invoice.count({
      where: { tenantId: "tenant_a", deletedAt: null },
    });

    const completeBtn = page.getByRole("button", {
      name: "Complete & Create Invoice",
      exact: true,
    });
    report.completeButtonVisible = (await completeBtn.count()) > 0;
    page.once("dialog", async (d) => d.accept());
    await completeBtn.click({ timeout: 15000 });
    await page.waitForTimeout(3500);

    const invoice = await db.invoice.findFirst({
      where: { tenantId: "tenant_a", deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    const finalizedSession = await db.chairsideSession.findFirst({
      where: {
        appointmentId: APPT,
        tenantId: "tenant_a",
        status: "FINALIZED",
        invoiceId: invoice?.id ?? undefined,
      },
      orderBy: { finalizedAt: "desc" },
    });
    const sessions = await db.chairsideSession.findMany({
      where: { appointmentId: APPT, tenantId: "tenant_a" },
      orderBy: { startedAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        invoiceId: true,
        finalizedAt: true,
        closedReason: true,
      },
    });

    report.invoice = invoice
      ? {
          id: invoice.id,
          number: invoice.invoiceNumber,
          encounterId: invoice.encounterId,
          total: invoice.total.toString(),
          tax: invoice.tax.toString(),
          subtotal: invoice.subtotal.toString(),
          items: invoice.items.map((i) => ({
            description: i.description,
            total: i.total.toString(),
            code: i.procedureCode,
          })),
        }
      : null;
    report.finalizedSession = finalizedSession
      ? {
          id: finalizedSession.id,
          status: finalizedSession.status,
          invoiceId: finalizedSession.invoiceId,
          finalizedAt: finalizedSession.finalizedAt?.toISOString() ?? null,
          closedReason: finalizedSession.closedReason,
        }
      : null;
    report.recentSessions = sessions.map((s) => ({
      id: s.id,
      status: s.status,
      invoiceId: s.invoiceId,
      finalizedAt: s.finalizedAt?.toISOString() ?? null,
      closedReason: s.closedReason,
    }));
    report.invoiceCreated = Boolean(invoice) && (await db.invoice.count({
      where: { tenantId: "tenant_a", deletedAt: null },
    })) > beforeCount;

    // Repeat finalize: button should be gone / session finalized — no second invoice
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const completeAgain = page.getByRole("button", {
      name: "Complete & Create Invoice",
      exact: true,
    });
    report.completeButtonAfterFinalize = (await completeAgain.count()) > 0;
    const invoiceCountAfter = await db.invoice.count({
      where: { tenantId: "tenant_a", deletedAt: null },
    });
    report.invoiceCountUnchangedOnReload = invoiceCountAfter === beforeCount + 1;

    // Legacy path may create another invoice on a NEW session with encounterId=null.
    // Prove unique(encounterId) does not block multiple NULL encounterIds.
    const patientId =
      finalizedSession?.patientId ??
      (
        await db.chairsideSession.findFirst({
          where: { appointmentId: APPT, tenantId: "tenant_a" },
          select: { patientId: true },
        })
      )?.patientId;
    if (patientId) {
      try {
        const second = await db.invoice.create({
          data: {
            tenantId: "tenant_a",
            patientId,
            encounterId: null,
            invoiceNumber: `INV-FLAGOFF-NULL-${Date.now()}`,
            status: "DRAFT",
            subtotal: 1,
            tax: 0,
            total: 1,
          },
        });
        report.nullEncounterIdSecondInvoice = {
          ok: true,
          id: second.id,
          encounterId: second.encounterId,
        };
        await db.invoice.update({
          where: { id: second.id },
          data: { deletedAt: new Date() },
        });
      } catch (e) {
        report.nullEncounterIdSecondInvoice = {
          ok: false,
          error: e instanceof Error ? e.message.slice(0, 200) : String(e),
        };
      }
    }

    report.hydrationWarnings = logs.filter((l) => /hydrat/i.test(l));
    report.console = logs.slice(0, 40);
    await page.screenshot({ path: `${OUT}/flag-off-full.png`, fullPage: true });

    if (!report.spineUnreachable) throw new Error("Spine route reachable with flag OFF");
    if (!report.timelineRedirectedAway) throw new Error("Timeline still reachable with flag OFF");
    if (!report.legacyOk) throw new Error("Legacy encounter workspace not reachable");
    if (!report.invoiceCreated) throw new Error("Expected new chairside invoice");
    if (invoice?.encounterId) {
      throw new Error("Legacy invoice unexpectedly set encounterId");
    }
    if (!(report.nullEncounterIdSecondInvoice as { ok?: boolean })?.ok) {
      throw new Error("Unique encounterId constraint blocked NULL duplicates (legacy regression)");
    }
  } catch (e) {
    report.error = e instanceof Error ? e.message : String(e);
    await page.screenshot({ path: `${OUT}/flag-off-error.png`, fullPage: true }).catch(() => null);
  } finally {
    await browser.close();
    await db.$disconnect();
    fs.writeFileSync(`${OUT}/flag-off-full.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (report.error) process.exitCode = 1;
  }
}

main();
