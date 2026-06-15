import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TrustBadges } from "./trust-badges";

type AuthShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  variant?: "signin" | "signup";
  compact?: boolean;
};

export function AuthShell({
  children,
  title,
  subtitle,
  backHref = "/",
  backLabel = "Back to home",
  variant = "signin",
  compact = false,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-sm font-bold text-zinc-950 shadow-lg shadow-sky-500/20">
              D
            </div>
            <span className="text-lg font-semibold tracking-tight">DentaFlow</span>
          </Link>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </header>

        <div className="flex flex-1 flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
          {!compact && (
            <aside className="lg:w-[42%] lg:pt-8">
              <Badge className="mb-4 border-sky-500/30 bg-sky-500/10 text-sky-300">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {variant === "signup" ? "Start your free trial" : "Welcome back"}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl lg:leading-tight">
                {variant === "signup" ? (
                  <>
                    Launch your clinic on{" "}
                    <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                      modern infrastructure
                    </span>
                  </>
                ) : (
                  <>
                    Sign in to your{" "}
                    <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                      clinic workspace
                    </span>
                  </>
                )}
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-400 sm:text-lg">
                {variant === "signup"
                  ? "Register your practice in minutes. Charting, scheduling, billing, and AI — all in one secure multi-tenant platform built for dental teams."
                  : "Access your dashboard, patients, appointments, and clinical tools. Your data stays isolated and secure within your clinic tenant."}
              </p>

              <ul className="mt-8 hidden space-y-3 text-sm text-zinc-400 lg:block">
                {(variant === "signup"
                  ? [
                      "14-day free trial — no credit card required",
                      "Interactive odontogram & smart scheduling",
                      "Per-clinic data isolation with Clerk Organizations",
                      "Upgrade anytime as your practice grows",
                    ]
                  : [
                      "Enterprise-grade tenant isolation",
                      "Real-time scheduling & clinical charting",
                      "Stripe billing & subscription management",
                      "Optional 2FA when enabled on your account",
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    {item}
                  </li>
                ))}
              </ul>

              <TrustBadges className="mt-10 hidden lg:block" />
            </aside>
          )}

          <main className={compact ? "mx-auto w-full max-w-md flex-1" : "flex-1 lg:max-w-xl"}>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-8">
              <div className={compact ? "mb-6" : "mb-8 lg:hidden"}>
                <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
                <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
              </div>
              {!compact && (
                <div className="mb-8 hidden lg:block">
                  <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
                  <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
                </div>
              )}
              {children}
            </div>
            <TrustBadges className="mt-6 lg:hidden" />
          </main>
        </div>
      </div>
    </div>
  );
}
