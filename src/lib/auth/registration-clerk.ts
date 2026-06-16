import { clerkClient } from "@/lib/auth/stubs/server";

/**
 * Clerk-only helpers safe for Edge middleware (no Prisma).
 */
export async function userHasOrganizationMembership(userId: string): Promise<boolean> {
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({ userId });
  return memberships.data.length > 0;
}
