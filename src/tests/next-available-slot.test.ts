import { describe, expect, it } from "vitest";

/** Mirrors ranking used by getNextAvailableSlotAnyDoctor */
function rankBySoonestNextSlot<
  T extends { nextSlot: string | null; availableSlots: number; doctorName: string },
>(doctors: T[]): T[] {
  const withSlot = doctors.filter(
    (d) => d.nextSlot != null && d.availableSlots > 0,
  );
  return withSlot.sort((a, b) => {
    const toMins = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h! * 60 + m!;
    };
    const aMins = toMins(a.nextSlot!);
    const bMins = toMins(b.nextSlot!);
    if (aMins !== bMins) return aMins - bMins;
    return a.doctorName.localeCompare(b.doctorName);
  });
}

describe("getNextAvailableSlotAnyDoctor ranking", () => {
  it("picks the soonest nextSlot across doctors", () => {
    const ranked = rankBySoonestNextSlot([
      {
        doctorName: "Dr. B",
        nextSlot: "11:00",
        availableSlots: 3,
      },
      {
        doctorName: "Dr. A",
        nextSlot: "09:30",
        availableSlots: 1,
      },
      {
        doctorName: "Dr. C",
        nextSlot: null,
        availableSlots: 0,
      },
    ]);

    expect(ranked[0]?.doctorName).toBe("Dr. A");
    expect(ranked[0]?.nextSlot).toBe("09:30");
    expect(ranked).toHaveLength(2);
  });

  it("ties break by doctor name", () => {
    const ranked = rankBySoonestNextSlot([
      { doctorName: "Dr. Z", nextSlot: "10:00", availableSlots: 2 },
      { doctorName: "Dr. M", nextSlot: "10:00", availableSlots: 2 },
    ]);
    expect(ranked[0]?.doctorName).toBe("Dr. M");
  });
});
