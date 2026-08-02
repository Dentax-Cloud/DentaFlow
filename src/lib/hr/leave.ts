/** Inclusive calendar-day count between two dates (UTC date parts). */
export function inclusiveDayCount(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (e < s) return 0;
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

export type LeaveBalance = {
  leaveTypeId: string;
  name: string;
  entitlement: number;
  usedApproved: number;
  pending: number;
  remaining: number;
};

export function computeLeaveBalance(input: {
  leaveTypeId: string;
  name: string;
  entitlement: number;
  approvedDayCount: number;
  pendingDayCount: number;
}): LeaveBalance {
  const usedApproved = Math.max(0, input.approvedDayCount);
  const pending = Math.max(0, input.pendingDayCount);
  return {
    leaveTypeId: input.leaveTypeId,
    name: input.name,
    entitlement: input.entitlement,
    usedApproved,
    pending,
    remaining: input.entitlement - usedApproved,
  };
}
