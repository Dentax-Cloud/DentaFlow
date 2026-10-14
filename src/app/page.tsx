export const runtime = "nodejs";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Play,
  Sparkles,
  CheckCircle2,
  Building2,
  LayoutDashboard,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FEATURE_SUMMARIES } from "@/lib/marketing/features";
import { HIGHLIGHTS, TRUST_LOGOS } from "@/lib/marketing/site";
import { getPublicSubscriptionPlans } from "@/lib/subscription/plans-display";
import { resolvePricingCountry } from "@/lib/geo/pricing-country";
import { SUPPORTED_COUNTRIES } from "@/lib/countries";

export default async function LandingPage() {
  const pricingCountry = await resolvePricingCountry();
  const plans = await getPublicSubscriptionPlans(pricingCountry.code);
  return (
    <MarketingShell>
      <main>
        {/* Hero */}
        <section className="relative px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-6 border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-300 hover:bg-sky-500/15">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI-Powered · Multi-Tenant · Built for Dental Clinics
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl lg:leading-[1.08]">
              Modern Dental Practice Management,{" "}
              <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                Powered by AI
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
              Run your entire clinic from one premium platform — interactive odontogram charting,
              intelligent scheduling, patient 360°, billing, and clinical AI — with enterprise-grade
              multi-tenant security.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-8 text-base font-semibold shadow-lg shadow-sky-500/25 hover:from-sky-500 hover:to-cyan-400"
                asChild
              >
                <Link href="/sign-up">
                  Start Free 14-Day Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/15 bg-white/5 px-8 text-base text-white hover:bg-white/10"
                asChild
              >
                <Link href="/login">Sign In</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/15 bg-transparent px-8 text-base text-zinc-300 hover:bg-white/5 hover:text-white"
                asChild
              >
                <Link href="/sign-in?demo=true">
                  <Play className="h-4 w-4" />
                  Try Demo
                </Link>
              </Button>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500/80" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-y border-white/5 bg-zinc-900/30 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
              Built on trusted infrastructure
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {TRUST_LOGOS.map((name) => (
                <span
                  key={name}
                  className="text-lg font-semibold tracking-tight text-zinc-600 transition-colors hover:text-zinc-400"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <PricingSection
          plans={plans}
          countries={SUPPORTED_COUNTRIES}
          currentCountry={pricingCountry.code}
          isOverride={pricingCountry.isOverride}
        />

        {/* Features grid */}
        <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mb-4 border-white/10 text-zinc-400">
                Clinical workflows, reimagined
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Everything your dental team needs
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                Explore each capability in depth — built exclusively for modern dental practices
                and DSOs.
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_SUMMARIES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Link
                    key={feature.slug}
                    href={feature.href}
                    className="group relative overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/40 p-8 transition-all duration-300 hover:border-sky-500/40 hover:bg-zinc-900/70"
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-0 transition-opacity group-hover:opacity-100`}
                    />
                    <div className="relative">
                      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl font-semibold tracking-tight group-hover:text-sky-300">
                        {feature.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        {feature.shortDescription}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-sky-400 opacity-0 transition-opacity group-hover:opacity-100">
                        Learn more
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Platform */}
        <section
          id="platform"
          className="border-t border-white/5 bg-gradient-to-b from-zinc-900/50 to-zinc-950 px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Multi-clinic ready from day one
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                Each clinic is an isolated tenant with its own patients, staff, branches, and
                billing. Scale from a single practice to a regional DSO without compromising
                security.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Per-tenant data isolation with Clerk Organizations",
                  "Branch & chair management for multi-location groups",
                  "Super-admin dashboard for platform operators",
                  "Starter → Professional → Enterprise plan gating",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="mt-8 rounded-xl" variant="outline" asChild>
                <Link href="/features/security">
                  Explore security
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-8">
              <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                <LayoutDashboard className="h-8 w-8 text-sky-400" />
                <div>
                  <p className="font-semibold">Unified command center</p>
                  <p className="text-sm text-zinc-500">Dashboard · Clinical · CRM · Reports</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {FEATURE_SUMMARIES.slice(0, 3).map((f) => (
                  <Link
                    key={f.slug}
                    href={f.href}
                    className="flex items-center justify-between rounded-lg bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
                  >
                    {f.title}
                    <ArrowRight className="h-4 w-4 text-zinc-600" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-white/5 px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-950/40 via-zinc-900 to-zinc-950 px-8 py-16 text-center shadow-xl shadow-sky-500/5 sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to modernize your dental practice?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              Join clinics using DentaFlow to deliver better patient care, streamline operations,
              and grow revenue — starting with a free 14-day trial.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 rounded-xl bg-white px-10 font-semibold text-zinc-950 hover:bg-zinc-100"
                asChild
              >
                <Link href="/sign-up">
                  Start Free 14-Day Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/20 bg-transparent px-10 text-white hover:bg-white/5"
                asChild
              >
                <Link href="/login">Sign In to Your Clinic</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
