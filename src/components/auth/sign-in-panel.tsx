"use client";

import { SignIn } from "@/lib/auth/stubs/client";

type Props = {
  redirectUrl?: string;
  className?: string;
};

export function SignInPanel({
  className = "w-full min-h-[280px]",
}: Props) {
  return (
    <div className={className}>
      <SignIn />
    </div>
  );
}
