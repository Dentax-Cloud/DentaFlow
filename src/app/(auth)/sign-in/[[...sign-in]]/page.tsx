export const runtime = "nodejs";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { SignInShell } from "@/components/auth/sign-in-shell";
import { SignInPageClient } from "@/components/auth/sign-in-page-client";
import { resolvePostAuthDestination } from "@/lib/auth/registration-status";

type Props = {
  params: Promise<{ "sign-in"?: string[] }>;
  searchParams: Promise<{ redirect_url?: string }>;
};

export default async function SignInPage({ params, searchParams }: Props) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id ?? null;
  const orgId = session?.user?.activeTenantId ?? null;

  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const isClerkSubRoute = (resolvedParams["sign-in"]?.length ?? 0) > 0;
  const redirectUrl = resolvedSearch.redirect_url ?? "/dashboard";
  const continueHref = await resolvePostAuthDestination(userId ?? "", orgId);

  if (userId && resolvedSearch.redirect_url && !isClerkSubRoute) {
    redirect(continueHref);
  }

  return (
    <SignInShell
      title={isClerkSubRoute ? "Verify your identity" : "Sign in"}
      subtitle={
        isClerkSubRoute
          ? "Complete verification to access your clinic."
          : "Use your email and password, or continue with Google."
      }
      compact={isClerkSubRoute}
    >
      <SignInPageClient redirectUrl={redirectUrl} continueHref={continueHref} />

      {!isClerkSubRoute && !userId && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          Registering a new clinic?{" "}
          <Link href="/sign-up" className="font-medium text-sky-400 hover:text-sky-300">
            Start free trial
          </Link>
        </p>
      )}
    </SignInShell>
  );
}
