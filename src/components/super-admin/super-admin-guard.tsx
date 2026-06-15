import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isSuperAdmin } from "@/lib/tenant/config";

type SuperAdminGuardProps = {
  children: React.ReactNode;
  fallbackUrl?: string;
};

/**
 * Server Component guard — wraps super-admin pages and layouts.
 */
export async function SuperAdminGuard({
  children,
  fallbackUrl = "/dashboard",
}: SuperAdminGuardProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!isSuperAdmin(userId)) redirect(fallbackUrl);
  return <>{children}</>;
}
