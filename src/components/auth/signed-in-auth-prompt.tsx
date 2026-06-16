"use client";

import Link from "next/link";
import { SignOutButton } from "@/lib/auth/stubs/client";
import { Button } from "@/components/ui/button";

type Props = {
  continueHref: string;
};

/** Shown when a user opens /sign-in while already authenticated (e.g. from the marketing site). */
export function SignedInAuthPrompt({ continueHref }: Props) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-zinc-300">
        You&apos;re already signed in. Continue to your clinic workspace or sign out to use a
        different account.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          asChild
          className="h-11 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-semibold hover:from-sky-500 hover:to-cyan-400"
        >
          <Link href={continueHref}>Continue to your clinic</Link>
        </Button>
        <SignOutButton redirectUrl="/sign-in">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl border-white/15 bg-zinc-900/80 text-white hover:bg-zinc-800 sm:w-auto"
          >
            Sign out
          </Button>
        </SignOutButton>
      </div>
    </div>
  );
}
