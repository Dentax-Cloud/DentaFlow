export function slugify(name: string, fallbackSuffix?: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const slug = base || "clinic";
  if (!fallbackSuffix) return slug;
  return `${slug}-${fallbackSuffix.slice(-8)}`;
}
