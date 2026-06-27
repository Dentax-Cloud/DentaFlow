import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user?.isSuperAdmin) redirect("/login");
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">Platform Superadmin</h1>
          <nav className="flex gap-4 text-sm">
            <a href="/superadmin" className="text-zinc-400 hover:text-white">
              Overview
            </a>
            <Link href="/superadmin/tenants" className="text-zinc-400 hover:text-white">
              Tenants
            </Link>
            <a href="/superadmin/settings" className="text-zinc-400 hover:text-white">
              Platform Settings
            </a>
            <a href="/dashboard" className="text-sky-400 hover:text-sky-300">
              Back to app
            </a>
          </nav>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
