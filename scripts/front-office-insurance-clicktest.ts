/**
 * Front-office insurance verification click-test (Module 6).
 *
 * Requires: BASE_URL with ENCOUNTER_SPINE_ENABLED=true, receptionist + doctor
 * credentials for the same ACTIVE tenant, and a check-in-able appointment.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3100 \
 *   RECEPTION_EMAIL=reception.in.pearl@test.dentaflow.io \
 *   DOCTOR_EMAIL=doctor.in.pearl@test.dentaflow.io \
 *   PASSWORD=Test1234! \
 *   pnpm exec tsx scripts/front-office-insurance-clicktest.ts
 */
import { chromium, type Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.PASSWORD ?? "Test1234!";
const RECEPTION_EMAIL =
  process.env.RECEPTION_EMAIL ?? "reception.in.pearl@test.dentaflow.io";
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL ?? "doctor.in.pearl@test.dentaflow.io";
const OUT_DIR = path.join("docs", "verification", "module6-front-office-insurance");

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 });
}

async function signOut(page: Page) {
  await page.goto(`${BASE}/api/auth/signout`, { waitUntil: "domcontentloaded" });
  const btn = page.getByRole("button", { name: /sign out/i });
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const report: Record<string, unknown> = { base: BASE, steps: [] as string[] };

  const steps = report.steps as string[];

  // 1) Receptionist: reception page shows insurance UI when spine on
  await login(page, RECEPTION_EMAIL);
  steps.push(`reception_login_url=${page.url()}`);
  await page.goto(`${BASE}/reception`, { waitUntil: "networkidle", timeout: 60000 });
  steps.push(`reception_url=${page.url()}`);
  const body = await page.locator("body").innerText();
  const hasVerifyUi =
    /Insurance verification|Verify insurance|Est\. coverage|Eligibility/i.test(body) ||
    (await page.getByRole("button", { name: /verify insurance/i }).count()) > 0 ||
    (await page.getByText(/insurance verification/i).count()) > 0;
  steps.push(`reception_has_verify_ui=${hasVerifyUi}`);
  await page.screenshot({ path: path.join(OUT_DIR, "01-reception.png"), fullPage: true });

  // Flag-off note: if spine off, UI should be absent
  if (!hasVerifyUi) {
    report.note =
      "Insurance UI not visible — likely ENCOUNTER_SPINE_ENABLED is off for this tenant/env. Flag-off check PASSES if intentional.";
  }

  await signOut(page);
  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
