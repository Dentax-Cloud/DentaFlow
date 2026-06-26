"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPortalPassword } from "../actions";

export default function ResetPasswordClient({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    startTransition(async () => {
      const result = await resetPortalPassword({ slug, token, newPassword: password });
      if (result.success) {
        router.push(`/portal/${slug}/login`);
      } else {
        setError(result.error ?? "Reset failed");
      }
    });
  }

  if (!token) {
    return <p className="text-red-600">Invalid reset link</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        className="w-full rounded-lg border px-4 py-3 text-sm"
      />
      <input
        type="password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        className="w-full rounded-lg border px-4 py-3 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Reset password"}
      </button>
      <Link href={`/portal/${slug}/login`} className="block text-center text-sm text-blue-600">
        Back to sign in
      </Link>
    </form>
  );
}
