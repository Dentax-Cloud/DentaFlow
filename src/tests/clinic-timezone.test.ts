import { describe, expect, it } from "vitest";
import {
  calendarGridToClinicUtc,
  clinicLocalToUtc,
  formatClinicTime,
  getClinicDayBounds,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";

describe("clinic-timezone", () => {
  it("defaults unset timezone to Asia/Dubai", () => {
    expect(resolveClinicTimezone(null)).toBe("Asia/Dubai");
    expect(resolveClinicTimezone("")).toBe("Asia/Dubai");
    expect(resolveClinicTimezone("America/New_York")).toBe("America/New_York");
  });

  it("converts Dubai local time to UTC", () => {
    const utc = clinicLocalToUtc("2026-07-06", "15:00", "Asia/Dubai");
    expect(utc.toISOString()).toBe("2026-07-06T11:00:00.000Z");
  });

  it("converts US Eastern local time to UTC", () => {
    const utc = clinicLocalToUtc("2026-07-06", "15:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-06T19:00:00.000Z");
  });

  it("formats stored UTC back to clinic wall clock", () => {
    const instant = clinicLocalToUtc("2026-07-06", "15:00", "Asia/Dubai");
    expect(formatClinicTime(instant, "Asia/Dubai")).toMatch(/15:00/);
  });

  it("returns clinic day bounds in UTC", () => {
    const { start, end } = getClinicDayBounds("2026-07-06", "Asia/Dubai");
    expect(start.toISOString()).toBe("2026-07-05T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-06T19:59:59.999Z");
  });

  it("calendarGridToClinicUtc matches clinicLocalToUtc for Dubai wall clock", () => {
    // Simulate browser-local Date representing 15:00 on the grid (Dubai staff machine).
    const gridDate = new Date(2026, 6, 6, 15, 0, 0);
    const fromGrid = calendarGridToClinicUtc(gridDate, "Asia/Dubai");
    const direct = clinicLocalToUtc("2026-07-06", "15:00", "Asia/Dubai");
    expect(fromGrid.toISOString()).toBe(direct.toISOString());
  });
});
