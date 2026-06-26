"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordClient({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestPasswordReset({ slug, email });
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">
          If an account exists for that email, we sent reset instructions.
        </p>
        <Link href={`/portal/${slug}/login`} className="mt-4 inline-block text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="w-full rounded-lg border px-4 py-3 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
