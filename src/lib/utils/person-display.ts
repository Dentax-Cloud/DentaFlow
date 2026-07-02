export function personInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string,
): string {
  const a = firstName?.charAt(0) ?? "";
  const b = lastName?.charAt(0) ?? "";
  if (a || b) return `${a}${b}`.toUpperCase();
  return fallback?.charAt(0).toUpperCase() ?? "?";
}

export function personDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string,
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email || "Unnamed";
}
