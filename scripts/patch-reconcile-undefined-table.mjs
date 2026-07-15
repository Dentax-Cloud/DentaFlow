/**
 * Make reconcile_schema_drift safe for greenfield migrate deploy.
 * Wraps ALTER TABLE / CREATE INDEX so missing tables (created later in history)
 * are skipped via undefined_table / undefined_object handlers.
 */
import fs from "node:fs";

const file = new URL(
  "../prisma/migrations/20260705143634_reconcile_schema_drift/migration.sql",
  import.meta.url,
);

let sql = fs.readFileSync(file, "utf8");
if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);

if (sql.includes("ignore undefined_table so greenfield")) {
  console.log("Already patched");
  process.exit(0);
}

const note =
  "-- 2026-07-15: also ignore undefined_table so greenfield migrate deploy can skip\n" +
  "-- ALTER/FK/INDEX ops that target tables created by later migrations (e.g. BarcodeScan).\n";

sql = sql.replace(/(-- Generated from prisma migrate diff[^\n]*\n)/, `$1${note}`);

sql = sql.replace(
  /EXCEPTION\s*\n(\s*)WHEN undefined_column THEN NULL;/g,
  "EXCEPTION\n$1WHEN undefined_table THEN NULL;\n$1WHEN undefined_column THEN NULL;",
);
sql = sql.replace(
  /EXCEPTION\s*\n(\s*)WHEN duplicate_object THEN NULL;/g,
  "EXCEPTION\n$1WHEN undefined_table THEN NULL;\n$1WHEN duplicate_object THEN NULL;",
);

const lines = sql.split(/\r?\n/);
const out = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  if (trimmed.startsWith("DO $$")) {
    out.push(line);
    i++;
    while (i < lines.length) {
      out.push(lines[i]);
      if (lines[i].trim() === "END $$;") break;
      i++;
    }
    i++;
    continue;
  }

  if (
    /^ALTER TABLE "/.test(trimmed) ||
    /^CREATE (UNIQUE )?INDEX IF NOT EXISTS/.test(trimmed)
  ) {
    out.push("DO $$ BEGIN");
    out.push(`  ${trimmed}`);
    out.push("EXCEPTION");
    out.push("  WHEN undefined_table THEN NULL;");
    out.push("  WHEN undefined_column THEN NULL;");
    out.push("  WHEN undefined_object THEN NULL;");
    out.push("  WHEN duplicate_table THEN NULL;");
    out.push("  WHEN duplicate_object THEN NULL;");
    out.push("END $$;");
    i++;
    continue;
  }

  out.push(line);
  i++;
}

const result = out.join("\n");
fs.writeFileSync(file, result, "utf8");
console.log("bytes", Buffer.byteLength(result, "utf8"));
console.log("bare ALTER", (result.match(/^ALTER TABLE "/gm) || []).length);
console.log(
  "bare CREATE INDEX",
  (result.match(/^CREATE (UNIQUE )?INDEX/gm) || []).length,
);
console.log("undefined_table count", (result.match(/undefined_table/g) || []).length);
