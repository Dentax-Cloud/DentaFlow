"use server";

import { getServerAuthSession } from "@/lib/auth";
import { resolvePostLoginUrl } from "@/lib/auth/post-login-redirect";

export async function resolvePostLoginRedirectAction(fallback = "/dashboard"): Promise<string> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return "/login";

  return resolvePostLoginUrl(session.user.id, {
    activeTenantId: session.user.activeTenantId,
    isSuperAdmin: session.user.isSuperAdmin,
  });
}
