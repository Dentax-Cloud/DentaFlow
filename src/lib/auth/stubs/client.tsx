"use client";

import type { ReactNode } from "react";

/** Passthrough — no provider required for stub auth. */
export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Placeholder sign-in surface until a real auth UI is wired. */
export function SignIn(_props?: unknown) {
  return (
    <div className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-zinc-900/40 p-8 text-center">
      <p className="text-sm font-medium text-zinc-200">Sign in</p>
      <p className="max-w-sm text-xs text-zinc-500">
        Authentication provider migration in progress. Sign-in will be available here after
        setup.
      </p>
    </div>
  );
}

export function SignOutButton({
  children,
}: {
  children: ReactNode;
  redirectUrl?: string;
}) {
  return <>{children}</>;
}

export function UserButton(_props?: { afterSignOutUrl?: string }) {
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-zinc-800 text-xs text-zinc-400"
      title="Account"
    >
      ?
    </div>
  );
}

export function OrganizationList(_props?: {
  hidePersonal?: boolean;
  afterCreateOrganizationUrl?: string;
  afterSelectOrganizationUrl?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
      Organization picker unavailable until auth provider is configured.
    </div>
  );
}

export function AuthenticateWithRedirectCallback(_props?: {
  signInForceRedirectUrl?: string;
  signUpForceRedirectUrl?: string;
}) {
  return (
    <div className="py-8 text-center text-sm text-zinc-500">
      OAuth callback handler not configured.
    </div>
  );
}

type StubUser = {
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  primaryPhoneNumber: { phoneNumber: string } | null;
  fullName: string | null;
  externalAccounts: Array<{ provider: string }>;
};

type SignUpStatus = "missing_requirements" | "complete";

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: false,
    userId: null as string | null,
  };
}

export function useUser() {
  return {
    isLoaded: true,
    user: null as StubUser | null,
  };
}

const signUpStub = {
  status: "missing_requirements" as SignUpStatus,
  createdSessionId: null as string | null,
  create: async (_args: Record<string, unknown>) => {},
  authenticateWithRedirect: async (_args: Record<string, unknown>) => {},
  prepareEmailAddressVerification: async (_args: Record<string, unknown>) => {},
  attemptEmailAddressVerification: async (_args: Record<string, unknown>) => ({
    createdSessionId: null as string | null,
    status: "missing_requirements" as SignUpStatus,
  }),
};

export function useSignUp() {
  return {
    isLoaded: true as const,
    signUp: signUpStub,
    setActive: async (_args: Record<string, unknown>) => {},
  };
}

export function useOrganizationList(_options?: unknown) {
  return {
    isLoaded: true as const,
    setActive: async (_args: Record<string, unknown>) => {},
  };
}
