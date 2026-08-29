"use client";

import { useState } from "react";

export function AnaesthesiaCosignDialog({
  open,
  procedureLabel,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  procedureLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-labelledby="cosign-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
      >
        <h2 id="cosign-title" className="text-lg font-semibold text-slate-900">
          Second provider co-sign
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Completing {procedureLabel} requires a second authenticated provider,
          distinct from the person logging this action.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(email, password);
          }}
        >
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Co-sign provider email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Co-sign provider password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </label>
          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-teal-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
              disabled={pending}
            >
              {pending ? "Confirming…" : "Confirm co-sign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
