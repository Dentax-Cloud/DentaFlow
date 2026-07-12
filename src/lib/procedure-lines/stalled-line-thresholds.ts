/** Visit Board UI — visual stall indicators (adjust here). */
export const VISIT_BOARD_AMBER_MINUTES = 2 * 60;
export const VISIT_BOARD_RED_MINUTES = 4 * 60;

/** Worker escalation job — time before owner warn / admin escalate (adjust here). */
export const STALLED_LINE_WARN_THRESHOLD_MS = 4 * 60 * 60 * 1000;
export const STALLED_LINE_ESCALATE_THRESHOLD_MS = 8 * 60 * 60 * 1000;

export type VisitBoardStallLevel = "normal" | "amber" | "red";

export function openDurationMinutes(createdAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000));
}

export function formatOpenDuration(createdAt: Date, now: Date = new Date()): string {
  const mins = openDurationMinutes(createdAt, now);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder > 0 ? `${hours}h ${remainder}min` : `${hours}h`;
}

export function visitBoardStallLevel(
  createdAt: Date,
  now: Date = new Date(),
): VisitBoardStallLevel {
  const mins = openDurationMinutes(createdAt, now);
  if (mins >= VISIT_BOARD_RED_MINUTES) return "red";
  if (mins >= VISIT_BOARD_AMBER_MINUTES) return "amber";
  return "normal";
}

export function hoursOpen(createdAt: Date, now: Date = new Date()): number {
  return (now.getTime() - createdAt.getTime()) / (60 * 60 * 1000);
}
