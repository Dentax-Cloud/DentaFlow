export const runtime = "nodejs";

import { requirePortalContext } from "@/lib/portal/portal-context";
import { redirect } from "next/navigation";
import BookClient from "./book-client";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requirePortalContext(slug);

  if (!ctx.tenant.bookingEnabled) {
    redirect(`/portal/${slug}/dashboard`);
  }

  return <BookClient slug={slug} secondaryLanguage={ctx.tenant.secondaryLanguage} />;
}
