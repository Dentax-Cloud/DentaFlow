import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Fallback when Tenant.timezone is unset (AE is the default country elsewhere). */
export const DEFAULT_CLINIC_TIMEZONE = "Asia/Dubai";

export function resolveClinicTimezone(timezone?: string | null): string {
  const trimmed = timezone?.trim();
  return trimmed || DEFAULT_CLINIC_TIMEZONE;
}

/**
 * Converts a clinic-local calendar date + wall-clock time to a UTC instant for storage.
 * @example clinicLocalToUtc("2026-07-06", "16:20", "Asia/Dubai") → 12:20 UTC
 */
export function clinicLocalToUtc(
  dateStr: string,
  timeStr: string,
  timezone: string,
): Date {
  const tz = resolveClinicTimezone(timezone);
  const [hours, minutes = "0"] = timeStr.split(":");
  const localIso = `${dateStr}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
  return fromZonedTime(localIso, tz);
}

/** UTC day boundaries for a clinic-local calendar date (for queries and filters). */
export function getClinicDayBounds(
  dateStr: string,
  timezone: string,
): { start: Date; end: Date } {
  const tz = resolveClinicTimezone(timezone);
  return {
    start: fromZonedTime(`${dateStr}T00:00:00.000`, tz),
    end: fromZonedTime(`${dateStr}T23:59:59.999`, tz),
  };
}

export function formatClinicTime(
  instant: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const tz = resolveClinicTimezone(timezone);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
    ...options,
  }).format(instant);
}

export function formatClinicDate(
  instant: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const tz = resolveClinicTimezone(timezone);
  return new Intl.DateTimeFormat("en-AE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
    ...options,
  }).format(instant);
}

/** Minutes since midnight in the clinic timezone for a stored UTC instant. */
export function clinicMinutesSinceMidnight(instant: Date, timezone: string): number {
  const timeStr = formatInTimeZone(instant, resolveClinicTimezone(timezone), "HH:mm");
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/** Clinic-local calendar date string (yyyy-MM-dd) for a stored UTC instant. */
export function clinicDateString(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, resolveClinicTimezone(timezone), "yyyy-MM-dd");
}

/** Current clinic-local date and minutes-since-midnight (for "today" / past-slot checks). */
export function getClinicNowParts(timezone: string): {
  dateStr: string;
  minutesSinceMidnight: number;
} {
  const tz = resolveClinicTimezone(timezone);
  const now = new Date();
  const dateStr = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const timeStr = formatInTimeZone(now, tz, "HH:mm");
  const [h, m] = timeStr.split(":").map(Number);
  return { dateStr, minutesSinceMidnight: h * 60 + m };
}

/**
 * Converts a react-big-calendar drag/drop Date (browser-local grid position) to UTC,
 * treating the grid wall-clock as clinic-local time (correct when staff browser ≈ clinic TZ).
 */
export function calendarGridToClinicUtc(gridDate: Date, timezone: string): Date {
  return clinicLocalToUtc(format(gridDate, "yyyy-MM-dd"), format(gridDate, "HH:mm"), timezone);
}

/** Split a datetime-local input value (yyyy-MM-ddTHH:mm) into date + time parts. */
export function splitDateTimeLocalValue(value: string): { date: string; time: string } {
  const [date, time = "00:00"] = value.split("T");
  return { date, time: time.slice(0, 5) };
}
