"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerForPortal } from "../actions";
import { DynamicPatientForm } from "@/components/patients/dynamic-patient-form";
import type { PatientFormField } from "@/lib/countries/patient-form-config";

export default function PortalRegisterClient({
  slug,
  formFields,
  countryCode,
}: {
  slug: string;
  formFields: PatientFormField[];
  countryCode: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!terms) {
      setError("Please accept the terms to continue");
      return;
    }

    const idDocKey = Object.keys(formValues).find((k) => k.startsWith("idDoc_"));
    const idDocumentNumber = idDocKey ? formValues[idDocKey] : undefined;

    startTransition(async () => {
      const result = await registerForPortal({
        slug,
        firstName: formValues.firstName ?? "",
        lastName: formValues.lastName ?? "",
        email: formValues.email ?? "",
        phone: formValues.phone || undefined,
        dateOfBirth: formValues.dateOfBirth || undefined,
        idDocumentNumber,
        password,
        formValues,
      });

      if (result.success) {
        router.push(`/portal/${slug}/verify-sent`);
      } else {
        setError(result.error ?? "Registration failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DynamicPatientForm
        fields={formFields}
        countryCode={countryCode}
        initialValues={formValues}
        onChange={setFormValues}
      />

      <div>
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Confirm password</label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-1"
        />
        <span>I agree to use this portal for my personal health information</span>
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Creating account..." : "Register"}
      </button>

      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link href={`/portal/${slug}/login`} className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
