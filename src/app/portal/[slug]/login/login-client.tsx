"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginToPortal, lookupPatientByPortalId } from "../actions";
import Link from "next/link";

export default function PortalLoginClient({
  slug,
  tenantName,
}: {
  slug: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [patientIdLookup, setPatientIdLookup] = useState("");
  const [error, setError] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await loginToPortal({ slug, email, password });
      if (result.success) {
        router.push(`/portal/${slug}/dashboard`);
        router.refresh();
      } else {
        setError(result.error ?? "Login failed");
      }
    });
  }

  async function handlePatientIdLookup() {
    if (!patientIdLookup.trim()) return;
    setLookupMsg("");
    const result = await lookupPatientByPortalId({ slug, patientId: patientIdLookup });
    if (result.found && result.email) {
      setEmail(result.email);
      setLookupMsg(`Found ${result.name}. Email pre-filled — enter your password to sign in.`);
    } else {
      setLookupMsg("No patient found with that ID. Try registering or contact the clinic.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-blue-50 p-4">
        <p className="text-sm font-medium">Have a patient ID card?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your Patient ID (e.g. PAT-AE-...) to look up your email
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={patientIdLookup}
            onChange={(e) => setPatientIdLookup(e.target.value)}
            placeholder="PAT-AE-..."
            className="flex-1 rounded-lg border px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            onClick={handlePatientIdLookup}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Look up
          </button>
        </div>
        {lookupMsg && <p className="mt-2 text-xs text-blue-700">{lookupMsg}</p>}
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="your@email.com"
            className="mt-1 w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">⚠ {error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !email || !password}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>

        <div className="flex justify-between text-sm">
          <Link href={`/portal/${slug}/forgot-password`} className="text-blue-600 hover:underline">
            Forgot password?
          </Link>
          <Link href={`/portal/${slug}/register`} className="text-blue-600 hover:underline">
            Register →
          </Link>
        </div>
      </form>

      <p className="text-center text-xs text-muted-foreground">{tenantName}</p>
    </div>
  );
}
