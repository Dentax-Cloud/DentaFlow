import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TrustBadges } from "./trust-badges";

type Props = {
  children: React.ReactNode;
  compact?: boolean;
};

export function SignUpShell({ children, compact = false }: Props) {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-sm font-bold text-zinc-950 shadow-lg shadow-sky-500/20">
              D
            </div>
            <span className="text-lg font-semibold tracking-tight">DentaFlow</span>
          </Link>
          <Link
            href={compact ? "/sign-up" : "/"}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {compact ? "Back to registration" : "Home"}
          </Link>
        </header>

        <div className="flex flex-1 flex-col gap-8 lg:flex-row lg:gap-12">
          {!compact && (
            <aside className="hidden max-w-sm lg:block lg:pt-4">
              <Badge className="mb-4 border-sky-500/30 bg-sky-500/10 text-sky-300">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                14-day free trial
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight leading-tight">
                Register your{" "}
                <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                  dental practice
                </span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Set up your clinic in minutes. Charting, scheduling, billing, and AI — purpose-built
                for modern dental teams with enterprise-grade data isolation.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-zinc-400">
                {[
                  "STARTER plan with 14-day trial",
                  "Per-clinic tenant isolation",
                  "No credit card required",
                  "Upgrade as you grow",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <TrustBadges className="mt-8" />
            </aside>
          )}

          <main className="flex-1 lg:max-w-3xl">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-8">
              {children}
            </div>
            {!compact && <TrustBadges className="mt-6 lg:hidden" />}
          </main>
        </div>
      </div>
    </div>
  );
}
