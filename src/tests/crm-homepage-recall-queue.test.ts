import { describe, expect, it } from "vitest";
import {
  homepageRecallQueueWhere,
  isInHomepageRecallQueue,
  overdueRecallWhere,
  recallActionWindow,
  recallQueueBucket,
  upcomingRecallWhere,
} from "@/lib/recall/queue";

const NOW = new Date("2026-08-18T12:00:00.000Z");
const TENANT = "tenant-kensington";

function pending(dueDate: Date) {
  return { status: "PENDING", completedAt: null, dueDate };
}

describe("recall action queue", () => {
  it("windows from start of local today through +30 days", () => {
    const { startOfToday, upcomingUntil } = recallActionWindow(NOW);
    expect(startOfToday.getHours()).toBe(0);
    expect(startOfToday.getMinutes()).toBe(0);
    expect(upcomingUntil.getTime() - startOfToday.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("homepage Prisma where is overdue ∪ upcoming (pending, incomplete, due by +30d)", () => {
    const overdue = overdueRecallWhere(TENANT, NOW);
    const upcoming = upcomingRecallWhere(TENANT, NOW);
    const homepage = homepageRecallQueueWhere(TENANT, NOW);

    expect(homepage).toEqual({
      tenantId: TENANT,
      status: "PENDING",
      completedAt: null,
      dueDate: { lte: upcoming.dueDate.lte },
    });
    expect(overdue.dueDate.lt).toEqual(upcoming.dueDate.gte);
    expect(homepage.dueDate.lte).toEqual(upcoming.dueDate.lte);
  });

  it("includes overdue and next-30-day recalls in the homepage widget", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const inTen = new Date(NOW);
    inTen.setDate(inTen.getDate() + 10);
    const inThirty = new Date(NOW);
    inThirty.setHours(0, 0, 0, 0);
    inThirty.setDate(inThirty.getDate() + 30);

    expect(recallQueueBucket(pending(yesterday), NOW)).toBe("overdue");
    expect(recallQueueBucket(pending(inTen), NOW)).toBe("upcoming");
    expect(recallQueueBucket(pending(inThirty), NOW)).toBe("upcoming");
    expect(isInHomepageRecallQueue(pending(yesterday), NOW)).toBe(true);
    expect(isInHomepageRecallQueue(pending(inTen), NOW)).toBe(true);
  });

  it("excludes far-future pending recalls that the old homepage listed", () => {
    const inThirtyOne = new Date(NOW);
    inThirtyOne.setHours(0, 0, 0, 0);
    inThirtyOne.setDate(inThirtyOne.getDate() + 31);

    expect(recallQueueBucket(pending(inThirtyOne), NOW)).toBeNull();
    expect(isInHomepageRecallQueue(pending(inThirtyOne), NOW)).toBe(false);
  });

  it("excludes completed or non-pending recalls even if dueDate is overdue", () => {
    const yesterday = new Date("2026-08-01T00:00:00.000Z");
    expect(
      isInHomepageRecallQueue(
        { status: "COMPLETED", completedAt: new Date("2026-08-02"), dueDate: yesterday },
        NOW,
      ),
    ).toBe(false);
    expect(
      isInHomepageRecallQueue({ status: "CANCELLED", completedAt: null, dueDate: yesterday }, NOW),
    ).toBe(false);
  });

  it("reproduces Kensington 2026-08-18: six ROUTINE due dates are not in the action queue", () => {
    const kensingtonDueDates = [
      "2027-01-22T17:59:29.216Z",
      "2027-01-23T07:14:18.046Z",
      "2027-01-23T13:12:46.685Z",
      "2027-01-23T13:38:09.238Z",
      "2027-01-30T03:34:00.636Z",
      "2027-02-18T18:41:21.746Z",
    ];

    for (const iso of kensingtonDueDates) {
      const recall = pending(new Date(iso));
      expect(recallQueueBucket(recall, NOW)).toBeNull();
      expect(isInHomepageRecallQueue(recall, NOW)).toBe(false);
    }

    expect(
      kensingtonDueDates.filter((iso) => isInHomepageRecallQueue(pending(new Date(iso)), NOW)),
    ).toHaveLength(0);
  });
});
