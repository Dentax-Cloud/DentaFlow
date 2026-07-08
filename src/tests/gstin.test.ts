import { describe, expect, it } from "vitest";
import { GSTIN_FORMAT_ERROR, isValidGstin } from "@/lib/billing/gstin";

describe("gstin validation", () => {
  it("accepts a valid GSTIN", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("22aaaaa0000a1z5")).toBe(true);
  });

  it("rejects malformed GSTIN", () => {
    expect(isValidGstin("INVALID")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Y5")).toBe(false);
  });

  it("allows empty GSTIN (optional field)", () => {
    expect(isValidGstin("")).toBe(true);
    expect(isValidGstin(null)).toBe(true);
  });

  it("exposes a clear format error message", () => {
    expect(GSTIN_FORMAT_ERROR).toContain("22AAAAA0000A1Z5");
    expect(GSTIN_FORMAT_ERROR).toContain("15 characters");
  });
});
