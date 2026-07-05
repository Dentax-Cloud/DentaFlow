/**
 * One-off backfill: default Mon–Fri schedules for clinical staff with zero rows.
 *
 * Idempotent — safe to re-run; skips doctors who already have any schedule.
 *
 * Usage:
 *   pnpm run backfill:doctor-schedules
 */
import { backfillDoctorSchedulesForAllTenants } from "@/lib/appointments/default-doctor-schedule";

backfillDoctorSchedulesForAllTenants()
  .then((summary) => {
    console.log("\n═══════════════════════════════════════════");
    console.log(" Doctor schedule backfill complete");
    console.log("═══════════════════════════════════════════");
    console.log(`  Doctors processed: ${summary.doctorsProcessed}`);
    console.log(`  Schedules created: ${summary.doctorsCreated}`);
    console.log(`  Skipped:           ${summary.doctorsSkipped}`);
    console.log("");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("\n❌ Backfill failed:", err);
    process.exit(1);
  });
