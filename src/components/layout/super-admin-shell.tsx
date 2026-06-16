import Link from "next/link";
import { UserButton } from "@/lib/auth/stubs/client";
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  ArrowLeft,
  CreditCard,
} from "lucide-react";

const navItems = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard },
  { href: "/super-admin#tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/tenant-approvals", label: "Approvals", icon: ShieldCheck },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-dental text-white font-bold">
            S
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">DentaFlow</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Super Admin
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/billing/subscription"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <CreditCard className="h-4 w-4" />
            My Subscription
          </Link>
        </nav>
        <div className="space-y-2 border-t p-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clinic
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
