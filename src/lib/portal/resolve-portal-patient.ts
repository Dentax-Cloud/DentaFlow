import { db } from "@/lib/db";

export async function resolvePortalPatients(clerkUserId: string) {
  return db.patient.findMany({
    where: { portalUserId: clerkUserId, deletedAt: null },
    include: { tenant: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
}

export async function resolvePortalPatientOrThrow(
  clerkUserId: string,
  preferredPatientId?: string,
) {
  const matches = await resolvePortalPatients(clerkUserId);
  if (matches.length === 0) throw new Error("PORTAL_NOT_LINKED");
  if (preferredPatientId) {
    const found = matches.find((m) => m.id === preferredPatientId);
    if (found) return found;
  }
  if (matches.length > 1) throw new Error("PORTAL_MULTIPLE_CLINICS");
  return matches[0]!;
}

