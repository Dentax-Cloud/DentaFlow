/**
 * Unauthenticated / client-tenantId template seed exports.
 * Seed helpers must stay file-private so they are not Next.js server actions.
 */
import { beforeAll, describe, expect, it } from "vitest";

describe("clinical template seed exports — tenant isolation", () => {
  let mod: typeof import("@/app/(dashboard)/features/clinical/template-actions");

  beforeAll(async () => {
    mod = await import("@/app/(dashboard)/features/clinical/template-actions");
  }, 60_000);

  it("does not export seedClinicalTemplatesForTenant (not a server action)", () => {
    expect(
      "seedClinicalTemplatesForTenant" in mod
        ? (mod as { seedClinicalTemplatesForTenant?: unknown }).seedClinicalTemplatesForTenant
        : undefined,
    ).toBeUndefined();
  });

  it("does not export seedPlatformTemplates (not a server action)", () => {
    expect(
      "seedPlatformTemplates" in mod
        ? (mod as { seedPlatformTemplates?: unknown }).seedPlatformTemplates
        : undefined,
    ).toBeUndefined();
  });
});
