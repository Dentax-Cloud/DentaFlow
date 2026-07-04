/**
 * One-off manual test-data seed — NOT part of prisma/seed.ts or container boot.
 *
 * Usage:
 *   pnpm run seed:test-data
 *   pnpm run seed:test-data -- --force
 */
import { runTestDataSeed } from "@/lib/seed/test-data/run-seed";

const force = process.argv.includes("--force");

runTestDataSeed(force)
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("\n❌ Test data seed failed:", err);
    process.exit(1);
  });
