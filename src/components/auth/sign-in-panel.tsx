"use client";

import { useLayoutEffect, useRef } from "react";
import { SignIn } from "@clerk/nextjs";
import type { SignInProps } from "@clerk/types";
import { buildSignInProps } from "@/lib/auth/clerk-sign-in-config";
import {
  ensureWeb3AuthDisabled,
  observeAndScrubWeb3,
} from "@/lib/auth/clerk-web3-blocker";

type Props = {
  redirectUrl?: string;
  signInProps?: SignInProps;
  className?: string;
};

if (typeof window !== "undefined") {
  ensureWeb3AuthDisabled();
}

/**
 * Renders Clerk SignIn with a stable component tree on every render.
 * Web3 is blocked at the provider level (window.ethereum) plus appearance/CSS/DOM scrub.
 */
export function SignInPanel({
  redirectUrl = "/dashboard",
  signInProps,
  className = "clerk-sign-in-root w-full min-h-[280px]",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ensureWeb3AuthDisabled();
    const uninstallObserver = rootRef.current
      ? observeAndScrubWeb3(rootRef.current)
      : () => {};

    return uninstallObserver;
  }, []);

  return (
    <div ref={rootRef} className={className}>
      <SignIn {...(signInProps ?? buildSignInProps(redirectUrl))} />
    </div>
  );
}
