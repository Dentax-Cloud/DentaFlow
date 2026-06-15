"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { SignedInAuthPrompt } from "@/components/auth/signed-in-auth-prompt";
import { ClerkSignInErrorBoundary } from "@/components/auth/clerk-sign-in-error-boundary";
import { ensureWeb3AuthDisabled } from "@/lib/auth/clerk-web3-blocker";

if (typeof window !== "undefined") {
  ensureWeb3AuthDisabled();
}

type Props = {
  redirectUrl: string;
  continueHref: string;
};

function SignInLoading() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      <p className="text-sm text-zinc-400">Loading sign in…</p>
    </div>
  );
}

/**
 * Stable client shell for /sign-in.
 * - useAuth() is always called (Rules of Hooks)
 * - <SignIn /> mounts only once, after Clerk has finished loading
 */
export function SignInPageClient({ redirectUrl, continueHref }: Props) {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) {
    return <SignInLoading />;
  }

  if (userId) {
    return <SignedInAuthPrompt continueHref={continueHref} />;
  }

  return (
    <ClerkSignInErrorBoundary>
      <SignInPanel redirectUrl={redirectUrl} />
    </ClerkSignInErrorBoundary>
  );
}
