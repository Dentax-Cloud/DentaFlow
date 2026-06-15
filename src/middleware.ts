import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { userHasOrganizationMembership } from "@/lib/auth/registration-clerk";
import { isSuperAdmin } from "@/lib/tenant/config";

/** Marketing and auth entry points — never redirect away in middleware. */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/features(.*)",
  "/api/webhooks(.*)",
  "/portal(.*)",
]);

const isSuperAdminRoute = createRouteMatcher(["/super-admin(.*)"]);
const isSelectOrgRoute = createRouteMatcher(["/select-org(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (isSuperAdminRoute(req)) {
    if (!isSuperAdmin(userId)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (isSelectOrgRoute(req)) {
    if (!orgId) {
      const hasMembership = await userHasOrganizationMembership(userId);
      if (!hasMembership) {
        return NextResponse.redirect(new URL("/sign-up", req.url));
      }
    }
    return NextResponse.next();
  }

  if (!orgId) {
    const hasMembership = await userHasOrganizationMembership(userId);
    return NextResponse.redirect(
      new URL(hasMembership ? "/select-org" : "/sign-up", req.url),
    );
  }

  // Registration completion is enforced in the dashboard layout (Node.js + Prisma).
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
