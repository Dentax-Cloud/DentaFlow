import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FeatureDetail } from "@/lib/marketing/features";
import { MarketingShell } from "./marketing-shell";

type Props = {
  feature: FeatureDetail;
};

export function buildFeatureMetadata(feature: FeatureDetail): Metadata {
  return {
    title: `${feature.title} — DentaFlow`,
    description: feature.metaDescription,
  };
}

export function FeatureDetailPage({ feature }: Props) {
  const Icon = feature.icon;

  return (
    <MarketingShell>
      <main>
        {/* Hero */}
        <section className="relative border-b border-white/5 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <Button
              variant="ghost"
              className="mb-8 -ml-2 text-zinc-400 hover:bg-white/5 hover:text-white"
              asChild
            >
              <Link href="/#features">
                <ArrowLeft className="h-4 w-4" />
                All features
              </Link>
            </Button>

            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge className="mb-4 border-sky-500/30 bg-sky-500/10 text-sky-300">
                  DentaFlow Feature
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{feature.title}</h1>
                <p className="mt-4 text-xl text-sky-300/90">{feature.heroSubtitle}</p>
                <p className="mt-6 text-lg leading-relaxed text-zinc-400">{feature.overview}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold shadow-lg shadow-sky-500/20"
                    asChild
                  >
                    <Link href="/sign-up">
                      Try this feature
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    asChild
                  >
                    <Link href="/">Back to home</Link>
                  </Button>
                </div>
              </div>

              <div
                className={`flex h-48 w-full max-w-sm shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${feature.accent} p-8 lg:h-56`}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25">
                  <Icon className="h-8 w-8" />
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {feature.highlights.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-zinc-950/50 px-3 py-1 text-xs text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why it matters</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {feature.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 rounded-xl border border-white/8 bg-zinc-900/40 p-5 text-sm text-zinc-300"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Capabilities */}
        <section className="border-t border-white/5 bg-zinc-900/20 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Key capabilities</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {feature.capabilities.map((cap) => (
                <article
                  key={cap.title}
                  className="rounded-2xl border border-white/8 bg-zinc-950/60 p-6 transition-colors hover:border-sky-500/25"
                >
                  <h3 className="font-semibold text-white">{cap.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{cap.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/30 to-zinc-950 px-8 py-12 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Experience {feature.title} in your clinic
            </h2>
            <p className="mt-3 text-zinc-400">
              Start your free 14-day trial — no credit card required.
            </p>
            <Button
              size="lg"
              className="mt-8 rounded-xl bg-white font-semibold text-zinc-950 hover:bg-zinc-100"
              asChild
            >
              <Link href="/sign-up">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
