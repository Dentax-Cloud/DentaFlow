import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TrustBadges } from "./trust-badges";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function SignInShell({
  children,
  title = "Sign in",
  subtitle = "Access your clinic workspace securely.",
  compact = false,
}: Props) {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[480px] w-[640px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-8 sm:px-6">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-sm font-bold text-zinc-950 shadow-lg shadow-sky-500/20">
              D
            </div>
            <span className="text-lg font-semibold tracking-tight">DentaFlow</span>
          </Link>
          <Link
            href={compact ? "/sign-in" : "/"}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {compact ? "Back" : "Home"}
          </Link>
        </header>

        <main className="mx-auto w-full flex-1">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-8">
            {children}
          </div>

          <TrustBadges className="mt-8" />
        </main>
      </div>
    </div>
  );
}
