export const runtime = "nodejs";

import Link from "next/link";

export default async function VerifySentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="py-12 text-center">
      <p className="mb-4 text-4xl">📧</p>
      <h1 className="text-xl font-bold">Check your email</h1>
      <p className="mt-2 text-muted-foreground">
        We sent a verification link. Click it to activate your portal account.
      </p>
      <Link
        href={`/portal/${slug}/login`}
        className="mt-6 inline-block text-blue-600 hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
