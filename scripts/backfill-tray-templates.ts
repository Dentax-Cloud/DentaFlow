/**
 * One-off backfill: seed 10 standard tray templates for tenants with zero templates.
 *
 * Usage:
 *   pnpm run backfill:tray-templates
 */
import { backfillTrayTemplatesForAllTenants } from "@/lib/chair-setup/seed-tray-templates";
import { STANDARD_TRAY_TEMPLATE_COUNT } from "@/lib/chair-setup/standard-tray-catalog";

backfillTrayTemplatesForAllTenants()
  .then((summary) => {
    console.log("\n═══════════════════════════════════════════");
    console.log(" Tray template backfill complete");
    console.log("═══════════════════════════════════════════");
    console.log(`  Tenants processed: ${summary.tenantsProcessed}`);
    console.log(`  Tenants seeded:    ${summary.tenantsSeeded}`);
    console.log(`  Tenants skipped:   ${summary.tenantsSkipped} (already had templates)`);
    console.log(`  Templates per tenant: up to ${STANDARD_TRAY_TEMPLATE_COUNT}`);

    for (const row of summary.results) {
      if (row.result.templatesCreated > 0) {
        console.log(
          `  ✓ ${row.slug}: ${row.result.templatesCreated} templates, ` +
            `${row.result.inventoryCreated} inventory items added`,
        );
      }
      for (const w of row.result.warnings) {
        console.warn(`  ⚠ ${row.slug}: ${w}`);
      }
    }
    console.log("");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("\n❌ Backfill failed:", err);
    process.exit(1);
  });
