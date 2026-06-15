"use client";

import { SignInPanel } from "@/components/auth/sign-in-panel";
import { buildPortalSignInProps } from "@/lib/auth/clerk-sign-in-config";

export default function PortalSignInPage() {
  return (
    <SignInPanel
      signInProps={buildPortalSignInProps()}
      className="clerk-sign-in-root flex min-h-screen items-center justify-center bg-muted/30 p-4"
    />
  );
}
