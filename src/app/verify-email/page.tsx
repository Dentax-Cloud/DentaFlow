import Link from "next/link";
import { verifyEmailToken } from "@/lib/auth/verify-email";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold">Email verification</h1>
        <p className="mt-2 text-muted-foreground">Missing verification token.</p>
        <Link href="/login" className="mt-6 text-dental underline">
          Back to login
        </Link>
      </div>
    );
  }

  const result = await verifyEmailToken(token);

  if (!result.success) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold">Verification failed</h1>
        <p className="mt-2 text-muted-foreground">{result.error}</p>
        <Link href="/login" className="mt-6 text-dental underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold text-emerald-600">Email verified</h1>
      <p className="mt-2 text-muted-foreground">
        Your email address has been verified. You can now sign in to DentaFlow.
      </p>
      <Link
        href="/login?verified=1"
        className="mt-6 inline-flex rounded-md bg-dental px-4 py-2 text-sm font-medium text-white"
      >
        Continue to login
      </Link>
    </div>
  );
}
