export const runtime = "nodejs";

import { Suspense } from "react";
import ResetPasswordClient from "./reset-client";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">Set new password</h1>
      <Suspense>
        <ResetPasswordClient slug={slug} />
      </Suspense>
    </div>
  );
}
