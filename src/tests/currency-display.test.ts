import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/countries";

describe("tenant-aware currency display", () => {
  it("formats UAE amounts with AED symbol", () => {
    const formatted = formatCurrency(1500, "AE");
    expect(formatted).toContain("AED");
    expect(formatted).not.toContain("$");
  });

  it("formats India amounts with rupee symbol", () => {
    const formatted = formatCurrency(2500, "IN");
    expect(formatted).toContain("₹");
    expect(formatted).not.toContain("$");
  });
});
