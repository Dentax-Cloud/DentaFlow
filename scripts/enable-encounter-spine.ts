/**
 * One-off / repeatable: enable the Module 6 encounter-spine feature flag for a
 * specific tenant whose featureFlags JSON pre-dates ENCOUNTER_SPINE_ENABLED
 * defaulting on at provision (see DEFAULT_TENANT_FEATURE_FLAGS). Without this,
 * /clinical/chair-prep silently redirects to /clinical for every user on that
 * tenant, since isEncounterSpineEnabled() reads a missing flag as OFF.
 *
 * Usage:
 *   pnpm run flags:enable-encounter-spine -- --find kensington   # list matches, no writes
 *   pnpm run flags:enable-encounter-spine -- --slug kensington-smile-studio   # apply
 */
import { PrismaClient } from "@prisma/client";
import { ENCOUNTER_SPINE_FLAG } from "../src/lib/encounter/feature-flag";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const findIdx = args.indexOf("--find");
  const slugIdx = args.indexOf("--slug");

  if (findIdx !== -1) {
    const term = args[findIdx + 1];
    if (!term) throw new Error("Usage: --find <search term>");
    const matches = await db.tenant.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      select: { id: true, name: true, slug: true, featureFlags: true },
    });
    console.log(`\nFound ${matches.length} tenant(s) matching "${term}":\n`);
    for (const t of matches) {
      const flags = (t.featureFlags as Record<string, unknown> | null) ?? {};
      console.log(
        `  slug=${t.slug}  name="${t.name}"  ${ENCOUNTER_SPINE_FLAG}=${flags[ENCOUNTER_SPINE_FLAG] ?? "(unset -> OFF)"}`,
      );
    }
    console.log("\nRe-run with --slug <exact slug> to apply the flag. No changes made.\n");
    return;
  }

  if (slugIdx !== -1) {
    const slug = args[slugIdx + 1];
    if (!slug) throw new Error("Usage: --slug <exact tenant slug>");
    const tenant = await db.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, featureFlags: true },
    });
    if (!tenant) throw new Error(`No tenant found with slug "${slug}"`);

    const existingFlags = (tenant.featureFlags as Record<string, unknown> | null) ?? {};
    const before = existingFlags[ENCOUNTER_SPINE_FLAG];
    const updated = await db.tenant.update({
      where: { id: tenant.id },
      data: {
        featureFlags: { ...existingFlags, [ENCOUNTER_SPINE_FLAG]: true },
      },
      select: { featureFlags: true },
    });

    console.log(`\nTenant "${tenant.name}" (${tenant.slug})`);
    console.log(`  ${ENCOUNTER_SPINE_FLAG}: ${before ?? "(unset)"} -> true`);
    console.log(`  featureFlags now: ${JSON.stringify(updated.featureFlags)}\n`);
    return;
  }

  throw new Error(
    "Usage:\n  --find <search term>   (list matching tenants, read-only)\n  --slug <exact slug>    (enable the flag for that tenant)",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
