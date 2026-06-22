"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import type { ReactNode } from "react";

export { signIn };

export function useAuth() {
  const { data: session, status } = useSession();
  return {
    isLoaded: status !== "loading",
    isSignedIn: !!session?.user?.id,
    userId: session?.user?.id ?? null,
    role: session?.user?.role ?? null,
    isSuperAdmin: session?.user?.isSuperAdmin ?? false,
    activeTenantId: session?.user?.activeTenantId ?? null,
  };
}

export function useUser() {
  const { data: session, status } = useSession();
  return {
    isLoaded: status !== "loading",
    user: session?.user ?? null,
  };
}

export function SignOutButton({
  children,
  redirectUrl = "/login",
}: {
  children: ReactNode;
  redirectUrl?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: redirectUrl })}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      {children}
    </button>
  );
}

export function UserButton(_props?: { afterSignOutUrl?: string }) {
  const { data: session } = useSession();
  const initials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-xs font-medium text-white"
      title={session?.user?.name ?? "Account"}
    >
      {initials}
    </div>
  );
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
