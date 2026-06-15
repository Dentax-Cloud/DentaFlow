import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isSuperAdmin } from "@/lib/tenant/config";

/**
 * Server-side guard for super-admin routes.
 * Redirects non-super-admins to the dashboard.
 */
export async function requireSuperAdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!isSuperAdmin(userId)) redirect("/dashboard");
  return userId;
}
