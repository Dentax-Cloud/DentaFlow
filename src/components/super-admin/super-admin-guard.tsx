import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";

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
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isSuperAdmin) redirect(fallbackUrl);
  return <>{children}</>;
}
