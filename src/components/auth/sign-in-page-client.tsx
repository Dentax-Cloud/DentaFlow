"use client";

import { useAuth } from "@/lib/auth/stubs/client";
import { Loader2 } from "lucide-react";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { SignedInAuthPrompt } from "@/components/auth/signed-in-auth-prompt";

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

export function SignInPageClient({ redirectUrl, continueHref }: Props) {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) {
    return <SignInLoading />;
  }

  if (userId) {
    return <SignedInAuthPrompt continueHref={continueHref} />;
  }

  return <SignInPanel redirectUrl={redirectUrl} />;
}
