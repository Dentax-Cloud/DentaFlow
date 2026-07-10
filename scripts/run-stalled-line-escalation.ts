/**
 * Manual verification helper for stalled procedure line escalation.
 *
 * Example:
 *   npx tsx scripts/run-stalled-line-escalation.ts
 *
 * To test warn/escalate thresholds, backdate a line's createdAt in the DB first:
 *   UPDATE "ProcedureLine" SET "createdAt" = NOW() - INTERVAL '5 hours'
 *   WHERE id = '<line-id>';
 */
import { db } from "@/lib/db";
import { processStalledProcedureLineEscalation } from "@/lib/procedure-lines/run-stalled-line-escalation";

async function main() {
  await db.$connect();
  const result = await processStalledProcedureLineEscalation();
  console.log(JSON.stringify(result, null, 2));
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
