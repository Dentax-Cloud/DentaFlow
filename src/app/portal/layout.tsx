import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { resolvePortalPatients } from "@/lib/portal/resolve-portal-patient";
import { getPortalPreferredPatientId } from "@/lib/portal/portal-session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/portal/sign-in");

  // If user is linked to multiple clinics, force them to choose a clinic (persisted via cookie)
  const matches = await resolvePortalPatients(userId);
  const preferred = await getPortalPreferredPatientId();
  if (matches.length > 1 && !preferred) {
    redirect("/portal/select-clinic");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/portal" className="flex items-center gap-2 font-bold">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-dental text-sm text-white">
              D
            </div>
            Patient Portal
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/portal/appointments" className="text-muted-foreground hover:text-foreground">
              Appointments
            </Link>
            <Link href="/portal/invoices" className="text-muted-foreground hover:text-foreground">
              Invoices
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl p-6">{children}</main>
    </div>
  );
}
