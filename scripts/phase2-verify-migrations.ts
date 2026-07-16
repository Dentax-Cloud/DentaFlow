/**
 * Migration evidence helper: BOM check + print constraint query SQL.
 * Deploy itself is run via shell (empty DB + from-main DB).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const MIG_DIR = path.join(ROOT, "prisma", "migrations");

function firstBytes(file: string, n = 8): number[] {
  const buf = fs.readFileSync(file);
  return [...buf.subarray(0, n)];
}

function main() {
  const migrations = fs
    .readdirSync(MIG_DIR)
    .filter((d) => fs.existsSync(path.join(MIG_DIR, d, "migration.sql")))
    .sort();

  const phase2 = migrations.filter((d) => /module6_phase2|20260927/.test(d));
  const report = {
    allMigrations: migrations,
    phase2Migrations: phase2,
    bomChecks: phase2.map((d) => {
      const file = path.join(MIG_DIR, d, "migration.sql");
      const bytes = firstBytes(file);
      const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
      const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
      const startsWithSqlComment =
        bytes[0] === 0x2d && bytes[1] === 0x2d && bytes[2] === 0x20; // "-- "
      return { migration: d, firstBytesHex: hex, hasBom, startsWithSqlComment };
    }),
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.bomChecks.some((c) => c.hasBom)) process.exitCode = 1;
}

main();
