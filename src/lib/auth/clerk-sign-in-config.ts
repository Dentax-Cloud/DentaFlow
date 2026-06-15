import type { SignInProps } from "@clerk/types";
import { clerkSignInAppearance } from "@/lib/auth/clerk-appearance";

/**
 * DentaFlow sign-in configuration — email/password + Google only.
 * Clerk has no public `additionalOptions` to disable Web3; we combine
 * appearance, layout, oauthFlow, and client-side Web3 blocking instead.
 */
export const dentaflowSignInOptions = {
  routing: "path",
  path: "/sign-in",
  signUpUrl: "/sign-up",
  oauthFlow: "redirect",
  transferable: true,
  appearance: clerkSignInAppearance,
} as const satisfies Partial<SignInProps>;

export function buildSignInProps(redirectUrl: string): SignInProps {
  return {
    ...dentaflowSignInOptions,
    forceRedirectUrl: redirectUrl,
    fallbackRedirectUrl: redirectUrl,
  };
}

export function buildPortalSignInProps(): SignInProps {
  return {
    routing: "path",
    path: "/portal/sign-in",
    signUpUrl: "/sign-up",
    afterSignInUrl: "/portal",
    oauthFlow: "redirect",
    appearance: clerkSignInAppearance,
  };
}
