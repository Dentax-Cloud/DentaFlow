import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  await db.auth_users.update({
    where: { id: session.user.id },
    data: { activeTenantId: null },
  });

  return NextResponse.redirect(new URL("/superadmin/tenants", appUrl));
}
