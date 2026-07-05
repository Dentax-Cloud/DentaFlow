"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserRole } from "@prisma/client";
import { getRoleLabel } from "@/lib/rbac/permissions";
import { isClinicalInviteRole } from "@/lib/staff/invite-profile";
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(invite?.email ?? "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
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

  const inviteInfo = invite;
  const showLicenseField = isClinicalInviteRole(inviteInfo.role);
  const roleLabel = (Object.values(UserRole) as string[]).includes(inviteInfo.role)
    ? getRoleLabel(inviteInfo.role as UserRole)
    : inviteInfo.role;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await acceptTeamInviteAction({
      token,
      email,
      firstName,
      lastName,
      phone,
      password,
      emergencyContactName: emergencyContactName || undefined,
      emergencyContactPhone: emergencyContactPhone || undefined,
      addressLine1: addressLine1 || undefined,
      city: city || undefined,
      country: country || undefined,
      licenseNumber: showLicenseField && licenseNumber ? licenseNumber : undefined,
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

    toast.success(`Welcome to ${inviteInfo.tenantName}!`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-white/10 bg-zinc-900 p-8">
      <h1 className="text-xl font-semibold text-white">Join {inviteInfo.tenantName}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {inviteInfo.inviterName} invited you as{" "}
        <strong className="text-zinc-200">{roleLabel}</strong>.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-zinc-300">First name</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Last name</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </div>
        </div>

        <div>
          <Label className="text-zinc-300">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            readOnly={!!inviteInfo.email}
            className="border-zinc-700 bg-zinc-800 text-white"
          />
        </div>

        <div>
          <Label className="text-zinc-300">Phone</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            placeholder="+971 50 123 4567"
            className="border-zinc-700 bg-zinc-800 text-white"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-zinc-300">Emergency contact name</Label>
            <Input
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              autoComplete="name"
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Emergency contact phone</Label>
            <Input
              type="tel"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              autoComplete="tel"
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </div>
        </div>

        <div>
          <Label className="text-zinc-300">Address line</Label>
          <Input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            autoComplete="address-line1"
            className="border-zinc-700 bg-zinc-800 text-white"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-zinc-300">City</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Country</Label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              autoComplete="country-name"
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </div>
        </div>

        {showLicenseField && (
          <div>
            <Label className="text-zinc-300">Professional license number</Label>
            <Input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Optional — clinic may require this later"
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </div>
        )}

        <div>
          <Label className="text-zinc-300">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
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
