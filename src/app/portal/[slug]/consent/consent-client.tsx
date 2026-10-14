"use client";

import Link from "next/link";
import { Bilingual } from "@/components/i18n/bilingual-text";
import { normalizeSecondaryLanguage } from "@/lib/i18n/secondary-languages";

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
  secondaryLanguage,
}: {
  forms: FormRow[];
  patientName: string;
  slug: string;
  secondaryLanguage?: string | null;
}) {
  const lang = normalizeSecondaryLanguage(secondaryLanguage);
  const pending = forms.filter(
    (f) => f.kind === "plan" && ["PROPOSED", "DRAFT"].includes(f.status),
  );
  const signed = forms.filter((f) => f.signedAt || f.status === "ACCEPTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">
          <Bilingual text="Consent & treatment forms" lang={lang} />
        </h1>
        <p className="text-sm text-muted-foreground">
          <Bilingual text="For" lang={lang} className="text-xs" /> {patientName}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-orange-700">
            <Bilingual text="Awaiting your review" lang={lang} className="text-xs font-normal text-orange-700/70" />
          </h2>
          {pending.map((f) => (
            <div key={f.id} className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground">
                <Bilingual text="Sent" lang={lang} className="text-xs" />{" "}
                {new Date(f.createdAt).toLocaleDateString("en-AE")}
              </p>
              {f.shareToken ? (
                <Link
                  href={`/plan/${f.shareToken}`}
                  target="_blank"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  <Bilingual text="Review and sign" lang={lang} className="text-xs" /> →
                </Link>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  <Bilingual text="Contact the clinic to complete this form" lang={lang} />
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {signed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            <Bilingual text="Completed" lang={lang} />
          </h2>
          {signed.map((f) => (
            <div key={f.id} className="rounded-xl border bg-white p-4">
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-green-700">
                ✓{" "}
                {f.signedAt ? (
                  <>
                    <Bilingual text="Signed" lang={lang} className="text-xs" />{" "}
                    {new Date(f.signedAt).toLocaleDateString("en-AE")}
                  </>
                ) : (
                  <Bilingual text="Completed" lang={lang} className="text-xs" />
                )}
              </p>
              {f.shareToken && (
                <Link href={`/plan/${f.shareToken}`} className="text-sm text-blue-600 hover:underline">
                  <Bilingual text="View" lang={lang} className="text-xs" /> →
                </Link>
              )}
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                  <Bilingual text="Download" lang={lang} className="text-xs" /> →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {forms.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-3 text-4xl">📋</p>
          <p>
            <Bilingual text="No forms shared with you yet" lang={lang} />
          </p>
        </div>
      )}
    </div>
  );
}
