"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptTeamInviteAction } from "./actions";

type InviteInfo = {
  tenantName: string;
  email: string;
  role: string;
  inviterName: string;
};

export function AcceptInviteClient({ invite }: { invite: InviteInfo | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(invite?.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!invite || !token) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-zinc-900 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Invalid invite</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This invitation link is invalid or has expired.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await acceptTeamInviteAction({
      token,
      email,
      name,
      password,
    });

    if (!result.success) {
      setLoading(false);
      toast.error(result.error);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: result.email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInResult?.error) {
      toast.success("Account created. Please sign in.");
      router.push("/login");
      return;
    }

    toast.success(`Welcome to ${invite.tenantName}!`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-8">
      <h1 className="text-xl font-semibold text-white">Join {invite.tenantName}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {invite.inviterName} invited you as <strong className="text-zinc-200">{invite.role}</strong>.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label className="text-zinc-300">Full name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border-zinc-700 bg-zinc-800 text-white"
          />
        </div>
        <div>
          <Label className="text-zinc-300">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            readOnly={!!invite.email}
            className="border-zinc-700 bg-zinc-800 text-white"
          />
        </div>
        <div>
          <Label className="text-zinc-300">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="border-zinc-700 bg-zinc-800 text-white"
          />
        </div>
        <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600" disabled={loading}>
          {loading ? "Creating account…" : "Accept invite"}
        </Button>
      </form>
    </div>
  );
}
