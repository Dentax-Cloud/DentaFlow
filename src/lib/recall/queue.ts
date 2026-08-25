export const RECALL_UPCOMING_DAYS = 30;

export type RecallQueueBucket = "overdue" | "upcoming" | null;

export type PendingRecallRecord = {
  status: string;
  completedAt: Date | null;
  dueDate: Date;
};

/** Start of local today through today + 30 days, matching `/crm/recalls`. */
export function recallActionWindow(now: Date = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const upcomingUntil = new Date(startOfToday);
  upcomingUntil.setDate(upcomingUntil.getDate() + RECALL_UPCOMING_DAYS);
  return { startOfToday, upcomingUntil };
}

export function pendingIncompleteRecallFilter(tenantId: string) {
  return {
    tenantId,
    status: "PENDING" as const,
    completedAt: null,
  };
}

export function overdueRecallWhere(tenantId: string, now: Date = new Date()) {
  const { startOfToday } = recallActionWindow(now);
  return {
    ...pendingIncompleteRecallFilter(tenantId),
    dueDate: { lt: startOfToday },
  };
}

export function upcomingRecallWhere(tenantId: string, now: Date = new Date()) {
  const { startOfToday, upcomingUntil } = recallActionWindow(now);
  return {
    ...pendingIncompleteRecallFilter(tenantId),
    dueDate: { gte: startOfToday, lte: upcomingUntil },
  };
}

/** Homepage widget: overdue ∪ upcoming (next 30 days). */
export function homepageRecallQueueWhere(tenantId: string, now: Date = new Date()) {
  const { upcomingUntil } = recallActionWindow(now);
  return {
    ...pendingIncompleteRecallFilter(tenantId),
    dueDate: { lte: upcomingUntil },
  };
}

export function recallQueueBucket(
  recall: PendingRecallRecord,
  now: Date = new Date(),
): RecallQueueBucket {
  if (recall.status !== "PENDING" || recall.completedAt) return null;
  const { startOfToday, upcomingUntil } = recallActionWindow(now);
  if (recall.dueDate < startOfToday) return "overdue";
  if (recall.dueDate <= upcomingUntil) return "upcoming";
  return null;
}

export function isInHomepageRecallQueue(
  recall: PendingRecallRecord,
  now: Date = new Date(),
): boolean {
  return recallQueueBucket(recall, now) !== null;
}
