export const runtime = "nodejs";

import { verifyPortalEmail } from "../actions";
import Link from "next/link";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">Invalid verification link</p>
        <Link href={`/portal/${slug}/login`} className="mt-4 text-blue-600 hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  const result = await verifyPortalEmail({ slug, token });

  return (
    <div className="py-12 text-center">
      {result.success ? (
        <>
          <p className="mb-4 text-4xl">✓</p>
          <h1 className="text-xl font-bold">Email verified</h1>
          <p className="mt-2 text-muted-foreground">You can now sign in to your portal account.</p>
          <Link
            href={`/portal/${slug}/login`}
            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
        </>
      ) : (
        <>
          <p className="text-red-600">{result.error}</p>
          <Link href={`/portal/${slug}/register`} className="mt-4 text-blue-600 hover:underline">
            Register again
          </Link>
        </>
      )}
    </div>
  );
}
