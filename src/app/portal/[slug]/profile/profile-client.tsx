"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changePortalPassword,
  logoutFromPortal,
  updatePortalProfile,
} from "../actions";
import { PortalNav, PortalDesktopNav } from "@/components/portal/portal-nav";

type ProfileProps = {
  slug: string;
  patient: {
    firstName: string;
    lastName: string;
    patientId: string | null;
    email: string | null;
    phone: string | null;
    bloodGroup: string | null;
    allergies: string[];
    dateOfBirth: string | null;
  };
};

export default function PortalProfileClient({ slug, patient }: ProfileProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [email, setEmail] = useState(patient.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  function copyPatientId() {
    if (patient.patientId && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(patient.patientId);
      setMessage("Patient ID copied");
    }
  }

  function handleProfileSave() {
    startTransition(async () => {
      const result = await updatePortalProfile({ slug, phone, email });
      setMessage(result.success ? "Profile updated" : (result.error ?? "Update failed"));
    });
  }

  function handlePasswordChange() {
    startTransition(async () => {
      const result = await changePortalPassword({
        slug,
        currentPassword,
        newPassword,
      });
      setMessage(result.success ? "Password changed" : (result.error ?? "Password change failed"));
      if (result.success) {
        setCurrentPassword("");
        setNewPassword("");
      }
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutFromPortal(slug);
      router.push(`/portal/${slug}/login`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PortalDesktopNav slug={slug} />
      <h1 className="text-xl font-bold">My Profile</h1>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold">Personal information</h2>
        <p>
          {patient.firstName} {patient.lastName}
        </p>
        {patient.dateOfBirth && (
          <p className="text-sm text-muted-foreground">
            DOB: {new Date(patient.dateOfBirth).toLocaleDateString("en-AE")}
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{patient.patientId ?? "—"}</span>
          {patient.patientId && (
            <button type="button" onClick={copyPatientId} className="text-xs text-blue-600">
              Copy
            </button>
          )}
        </div>
        {patient.bloodGroup && (
          <p className="text-sm">Blood group: {patient.bloodGroup}</p>
        )}
        {patient.allergies.length > 0 && (
          <p className="text-sm text-red-700">Allergies: {patient.allergies.join(", ")}</p>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold">Update contact details</h2>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleProfileSave}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Save contact details
        </button>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold">Change password</h2>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min 8 chars)"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handlePasswordChange}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Update password
        </button>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}

      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="w-full rounded-lg border border-red-200 py-3 text-red-600 hover:bg-red-50"
      >
        Sign out
      </button>

      <PortalNav slug={slug} />
    </div>
  );
}
