import { describe, expect, it } from "vitest";
import {
  formatOpenDuration,
  openDurationMinutes,
  visitBoardStallLevel,
  VISIT_BOARD_AMBER_MINUTES,
  VISIT_BOARD_RED_MINUTES,
} from "@/lib/procedure-lines/stalled-line-thresholds";

describe("stalled line thresholds", () => {
  const base = new Date("2026-07-10T10:00:00.000Z");

  it("formats short open durations in minutes", () => {
    const now = new Date(base.getTime() + 45 * 60_000);
    expect(formatOpenDuration(base, now)).toBe("45 min");
  });

  it("formats longer open durations in hours and minutes", () => {
    const now = new Date(base.getTime() + (2 * 60 + 10) * 60_000);
    expect(formatOpenDuration(base, now)).toBe("2h 10min");
  });

  it("flags amber after VISIT_BOARD_AMBER_MINUTES", () => {
    const now = new Date(base.getTime() + (VISIT_BOARD_AMBER_MINUTES + 1) * 60_000);
    expect(visitBoardStallLevel(base, now)).toBe("amber");
    expect(openDurationMinutes(base, now)).toBeGreaterThan(VISIT_BOARD_AMBER_MINUTES);
  });

  it("flags red after VISIT_BOARD_RED_MINUTES", () => {
    const now = new Date(base.getTime() + (VISIT_BOARD_RED_MINUTES + 5) * 60_000);
    expect(visitBoardStallLevel(base, now)).toBe("red");
  });
});
