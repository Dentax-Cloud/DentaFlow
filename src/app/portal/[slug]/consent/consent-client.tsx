"use client";

import Link from "next/link";

type FormRow = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  signedAt: string | null;
  shareToken: string | null;
  url?: string;
  kind: "plan" | "attachment";
};

export default function PortalConsentClient({
  forms,
  patientName,
  slug,
}: {
  forms: FormRow[];
  patientName: string;
  slug: string;
}) {
  const pending = forms.filter(
    (f) => f.kind === "plan" && ["PROPOSED", "DRAFT"].includes(f.status),
  );
  const signed = forms.filter((f) => f.signedAt || f.status === "ACCEPTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Consent & treatment forms</h1>
        <p className="text-sm text-muted-foreground">For {patientName}</p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-orange-700">Awaiting your review</h2>
          {pending.map((f) => (
            <div key={f.id} className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground">
                Sent {new Date(f.createdAt).toLocaleDateString("en-AE")}
              </p>
              {f.shareToken ? (
                <Link
                  href={`/plan/${f.shareToken}`}
                  target="_blank"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  Review and sign →
                </Link>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Contact the clinic to complete this form
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {signed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Completed</h2>
          {signed.map((f) => (
            <div key={f.id} className="rounded-xl border bg-white p-4">
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-green-700">
                ✓ {f.signedAt ? `Signed ${new Date(f.signedAt).toLocaleDateString("en-AE")}` : "Completed"}
              </p>
              {f.shareToken && (
                <Link href={`/plan/${f.shareToken}`} className="text-sm text-blue-600 hover:underline">
                  View →
                </Link>
              )}
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                  Download →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {forms.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-3 text-4xl">📋</p>
          <p>No forms shared with you yet</p>
        </div>
      )}
    </div>
  );
}
