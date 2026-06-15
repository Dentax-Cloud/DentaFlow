import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_NAV } from "@/lib/marketing/site";

export function MarketingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
      <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="absolute bottom-0 left-0 h-64 w-96 rounded-full bg-blue-600/5 blur-[80px]" />
    </div>
  );
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 font-bold text-zinc-950 shadow-lg shadow-sky-500/20">
            D
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">DentaFlow</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          {MARKETING_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            className="text-zinc-300 hover:bg-white/5 hover:text-white"
            asChild
          >
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button
            className="bg-white font-semibold text-zinc-950 shadow hover:bg-zinc-100"
            asChild
          >
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400 text-xs font-bold text-zinc-950">
            D
          </div>
          © {new Date().getFullYear()} DentaFlow. All rights reserved.
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
          <Link href="/sign-up" className="hover:text-white">
            Sign Up
          </Link>
          <Link href="/sign-in" className="hover:text-white">
            Sign In
          </Link>
          <Link href="/#features" className="hover:text-white">
            Features
          </Link>
        </div>
      </div>
    </footer>
  );
}

type MarketingShellProps = {
  children: React.ReactNode;
};

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">
      <MarketingBackground />
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
