export const runtime = "nodejs";

import { getPortalTenant } from "@/lib/portal/portal-context";
import { notFound } from "next/navigation";
import ForgotPasswordClient from "./forgot-client";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPortalTenant(slug);
  if (!tenant) notFound();

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">Reset password</h1>
      <ForgotPasswordClient slug={slug} />
    </div>
  );
}
