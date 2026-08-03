const DEFAULT_WINDOW_DAYS = 30;

/** True when expiresAt is within [now, now + windowDays] (inclusive of today). */
export function isCredentialExpiringSoon(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
  windowDays: number = DEFAULT_WINDOW_DAYS,
): boolean {
  if (expiresAt == null) return false;
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + windowDays);
  end.setHours(23, 59, 59, 999);
  return exp >= start && exp <= end;
}

export function credentialExpiryWindowDays(): number {
  const raw = process.env.HR_CREDENTIAL_EXPIRY_WINDOW_DAYS;
  const n = raw ? Number(raw) : DEFAULT_WINDOW_DAYS;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_WINDOW_DAYS;
}
