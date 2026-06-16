"use client";

import { SignOutButton, useUser } from "@/lib/auth/stubs/client";
import { Button } from "@/components/ui/button";

type Props = {
  /** When true, the active org already finished clinic registration. */
  registrationComplete: boolean;
};

/** Warns signed-in users who opened /sign-up to register another clinic. */
export function RegistrationSessionBanner({ registrationComplete }: Props) {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user || !registrationComplete) {
    return null;
  }

  const email = user.primaryEmailAddress?.emailAddress ?? user.fullName ?? "your account";

  return (
    <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <p>
        Signed in as <span className="font-medium text-white">{email}</span>. To register a{" "}
        <strong>new</strong> clinic under a different account, sign out first.
      </p>
      <SignOutButton redirectUrl="/sign-up">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 border-amber-500/30 bg-transparent text-amber-100 hover:bg-amber-500/10"
        >
          Sign out and register new clinic
        </Button>
      </SignOutButton>
    </div>
  );
}
