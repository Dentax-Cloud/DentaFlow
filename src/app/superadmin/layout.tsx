import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user?.isSuperAdmin) redirect("/login");
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold">Platform Superadmin</h1>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
