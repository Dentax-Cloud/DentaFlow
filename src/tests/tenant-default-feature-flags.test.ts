import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ENCOUNTER_SPINE_FLAG, isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { HR_MODULE_FLAG } from "@/lib/hr/feature-flag";
import { DEFAULT_TENANT_FEATURE_FLAGS } from "@/lib/tenant/default-feature-flags";

describe("DEFAULT_TENANT_FEATURE_FLAGS", () => {
  it("keeps HR module off for newly provisioned tenants", () => {
    expect(DEFAULT_TENANT_FEATURE_FLAGS[HR_MODULE_FLAG]).toBe(false);
  });

  it("enables encounter spine for newly provisioned tenants", () => {
    expect(DEFAULT_TENANT_FEATURE_FLAGS[ENCOUNTER_SPINE_FLAG]).toBe(true);
    const prev = process.env.ENCOUNTER_SPINE_ENABLED;
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    expect(
      isEncounterSpineEnabled({ featureFlags: { ...DEFAULT_TENANT_FEATURE_FLAGS } }),
    ).toBe(true);
    if (prev === undefined) delete process.env.ENCOUNTER_SPINE_ENABLED;
    else process.env.ENCOUNTER_SPINE_ENABLED = prev;
  });

  it("is wired into provisionTenant tenant.create", () => {
    const src = readFileSync(
      resolve(__dirname, "../lib/tenant/service.ts"),
      "utf8",
    );
    expect(src).toContain("DEFAULT_TENANT_FEATURE_FLAGS");
    expect(src).toMatch(/featureFlags:\s*\{\s*\.\.\.DEFAULT_TENANT_FEATURE_FLAGS\s*\}/);
  });
});
