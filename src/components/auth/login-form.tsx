"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resolvePostLoginRedirectAction } from "@/app/login/actions";
import { resendVerificationEmailAction } from "@/app/(auth)/features/registration/resend-verification-action";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const justVerified = searchParams.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsVerification(false);
    setResendState("idle");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setError("Please verify your email before signing in.");
      } else {
        setError("Invalid email or password.");
      }
      return;
    }

    const isSafeCallback =
      callbackUrl &&
      callbackUrl.startsWith("/") &&
      !callbackUrl.startsWith("/login") &&
      !callbackUrl.startsWith("/sign-in");

    const destination = isSafeCallback
      ? callbackUrl
      : await resolvePostLoginRedirectAction();

    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {justVerified && !error && (
        <p className="text-sm text-emerald-600">Email verified — you can now sign in.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {needsVerification && (
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={resendState === "sending" || resendState === "sent"}
            onClick={async () => {
              setResendState("sending");
              await resendVerificationEmailAction(email);
              setResendState("sent");
            }}
          >
            {resendState === "sent" ? "Verification email sent" : "Resend verification email"}
          </Button>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
