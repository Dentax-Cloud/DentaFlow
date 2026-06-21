import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Access your clinic workspace" variant="signin" compact>
      <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
