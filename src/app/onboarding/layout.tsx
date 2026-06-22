import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { resolvePostAuthDestination } from "@/lib/auth/registration-status";

/** Legacy route — new clinics use /sign-up wizard. */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id ?? null;
  const orgId = session?.user?.activeTenantId ?? null;

  if (!userId) redirect("/login");

  if (!orgId) {
    redirect(await resolvePostAuthDestination(userId, orgId));
  }

  return <>{children}</>;
}
