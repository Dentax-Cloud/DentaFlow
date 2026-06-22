import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";

/**
 * Server-side guard for super-admin routes.
 * Redirects non-super-admins to the dashboard.
 */
export async function requireSuperAdminPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");
  return session.user.id;
}

export async function requireSuperAdminGuard() {
  const session = await getServerAuthSession();
  if (!session?.user?.isSuperAdmin) {
    throw new Error("FORBIDDEN");
  }
  return session.user.id;
}
