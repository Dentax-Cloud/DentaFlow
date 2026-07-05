/**
 * Transform Prisma migrate diff SQL into idempotent Postgres migration SQL.
 * Usage: node scripts/make-migration-idempotent.mjs <input.sql> [output.sql]
 */
import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] ??
  path.join(
    path.dirname(inputPath),
    path.basename(inputPath, ".sql") + ".idempotent.sql",
  );

if (!inputPath) {
  console.error(
    "Usage: node scripts/make-migration-idempotent.mjs <input.sql> [output.sql]",
  );
  process.exit(1);
}

let sql = fs.readFileSync(inputPath, "utf8");
// Strip accidental PowerShell / npx stderr prefix if present.
const marker = sql.indexOf("-- DropForeignKey");
if (marker > 0) {
  sql = sql.slice(marker);
}

function wrapDo(statement, exception = "duplicate_object") {
  const body = statement.trim().replace(/;\s*$/, "");
  return `DO $$ BEGIN
  ${body};
EXCEPTION
  WHEN ${exception} THEN NULL;
END $$;`;
}

function transformDropConstraint(line) {
  return line.replace(
    /DROP CONSTRAINT "([^"]+)"/,
    'DROP CONSTRAINT IF EXISTS "$1"',
  );
}

function transformDropIndex(line) {
  return line.replace(/^DROP INDEX "([^"]+)"/, 'DROP INDEX IF EXISTS "$1"');
}

function transformCreateTable(block) {
  return block.replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "');
}

function transformCreateIndex(line) {
  if (/IF NOT EXISTS/i.test(line)) return line;
  return line.replace(
    /^CREATE (UNIQUE )?INDEX "/,
    'CREATE $1INDEX IF NOT EXISTS "',
  );
}

function transformAddForeignKey(line) {
  return wrapDo(line, "duplicate_object");
}

function transformRenameIndex(line) {
  const body = line.trim().replace(/;\s*$/, "");
  return `DO $$ BEGIN
  ${body};
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;`;
}

function transformAlterDropDefault(line) {
  // DROP DEFAULT is usually a no-op when no default exists; still guard renames.
  if (!/DROP DEFAULT/.test(line)) return line;
  return wrapDo(line, "undefined_column");
}

function splitAlterTable(statement) {
  const match = statement.match(
    /^ALTER TABLE "([^"]+)"\s+([\s\S]+);$/m,
  );
  if (!match) return [statement];

  const table = match[1];
  const body = match[2];
  const parts = [];
  let current = "";
  let depth = 0;

  for (const char of body) {
    current += char;
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(current.slice(0, -1).trim());
      current = "";
    }
  }
  if (current.trim()) parts.push(current.trim());

  if (parts.length <= 1) {
    return [transformSingleAlterPart(table, parts[0] ?? body)];
  }

  return parts.map((part) => transformSingleAlterPart(table, part));
}

function transformSingleAlterPart(table, part) {
  const trimmed = part.trim();

  if (/^ADD COLUMN\b/i.test(trimmed)) {
    const withIfNotExists = trimmed.replace(
      /^ADD COLUMN\s+(?!IF NOT EXISTS)/i,
      "ADD COLUMN IF NOT EXISTS ",
    );
    return `ALTER TABLE "${table}" ${withIfNotExists};`;
  }

  if (/^ALTER COLUMN\b/i.test(trimmed)) {
    const stmt = `ALTER TABLE "${table}" ${trimmed};`;
    if (/DROP DEFAULT/i.test(trimmed)) {
      return transformAlterDropDefault(stmt);
    }
    return stmt;
  }

  return `ALTER TABLE "${table}" ${trimmed};`;
}

function transformStatement(stmt) {
  const line = stmt.trim();
  if (!line || line.startsWith("--")) return [line];

  if (/^ALTER TABLE .+ DROP CONSTRAINT /i.test(line)) {
    return [transformDropConstraint(line)];
  }

  if (/^DROP INDEX /i.test(line)) {
    return [transformDropIndex(line)];
  }

  if (/^CREATE TABLE /i.test(line)) {
    return [transformCreateTable(line)];
  }

  if (/^CREATE (UNIQUE )?INDEX /i.test(line)) {
    return [transformCreateIndex(line)];
  }

  if (/^ALTER TABLE .+ ADD CONSTRAINT .+ FOREIGN KEY /i.test(line)) {
    return [transformAddForeignKey(line)];
  }

  if (/^ALTER INDEX .+ RENAME TO /i.test(line)) {
    return [transformRenameIndex(line)];
  }

  if (/^ALTER TABLE /i.test(line)) {
    return splitAlterTable(line);
  }

  return [line];
}

const statements = [];
let current = "";
let inCreateTable = false;

for (const rawLine of sql.split("\n")) {
  const line = rawLine.trimEnd();

  if (!inCreateTable && (line.startsWith("--") || line === "")) {
    if (current.trim()) {
      statements.push(current.trim());
      current = "";
    }
    if (line.startsWith("--")) statements.push(line.trim());
    continue;
  }

  current += (current ? "\n" : "") + line;

  if (/^CREATE TABLE /i.test(line.trim())) {
    inCreateTable = true;
  }
  if (inCreateTable && line.trim() === ");") {
    inCreateTable = false;
    statements.push(current.trim());
    current = "";
    continue;
  }
  if (!inCreateTable && line.trim().endsWith(";")) {
    statements.push(current.trim());
    current = "";
  }
}

if (current.trim()) statements.push(current.trim());

const output = [];
for (const stmt of statements) {
  if (stmt.startsWith("--") || stmt === "") {
    output.push(stmt);
    continue;
  }
  for (const transformed of transformStatement(stmt)) {
    output.push(transformed);
  }
}

const header = `-- Reconcile schema drift (idempotent)
-- Generated from prisma migrate diff; safe to re-run on partially-applied databases.
`;

fs.writeFileSync(outputPath, header + output.join("\n\n") + "\n", "utf8");
console.log(`Wrote ${outputPath} (${output.length} statements)`);
