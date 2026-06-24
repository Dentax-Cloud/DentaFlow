/**
 * NextAuth JWT middleware — single sign-in entry at /login (B9).
 * Superadmin: /superadmin/* and legacy /super-admin/* (H7).
 */
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isPublicPath, isProtectedTenantAppRoute } from "@/lib/auth/middleware-helpers";

const BLOCKED_SUBSCRIPTION_STATUSES = ["EXPIRED", "CANCELED", "TRIAL_EXPIRED"];
const BLOCKED_TENANT_STATUSES = ["SUSPENDED", "CLOSED"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Legacy sign-in URL → /login
    if (pathname.startsWith("/sign-in")) {
      const loginUrl = new URL("/login", req.url);
      const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") ?? "/dashboard";
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    const isSuperAdminRoute =
      pathname.startsWith("/superadmin") || pathname.startsWith("/super-admin");

    if (isSuperAdminRoute) {
      if (!token?.isSuperAdmin) {
        if (token?.activeTenantId) {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        return NextResponse.redirect(new URL("/login?error=Unauthorized", req.url));
      }

      if (pathname.startsWith("/super-admin")) {
        const newPath = pathname.replace("/super-admin", "/superadmin");
        return NextResponse.redirect(new URL(newPath, req.url));
      }
    }

    if (!isSuperAdminRoute && token?.isSuperAdmin) {
      const allowedPaths = ["/api/", "/login", "/superadmin", "/verify-email"];
      const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        return NextResponse.redirect(new URL("/superadmin/tenants", req.url));
      }
    }

    // Trial / subscription enforcement for tenant app routes
    if (
      !token?.isSuperAdmin &&
      token?.activeTenantId &&
      isProtectedTenantAppRoute(pathname)
    ) {
      const subStatus = token.subscriptionStatus as string | null | undefined;
      const tenantStatus = token.tenantStatus as string | null | undefined;
      const subscriptionBlocked =
        subStatus && BLOCKED_SUBSCRIPTION_STATUSES.includes(subStatus);
      const tenantBlocked =
        tenantStatus && BLOCKED_TENANT_STATUSES.includes(tenantStatus);

      if (subscriptionBlocked || tenantBlocked) {
        const allowed =
          pathname.startsWith("/billing/subscription") ||
          pathname.startsWith("/pending-approval");
        if (!allowed) {
          const reason = subscriptionBlocked ? "expired" : "suspended";
          return NextResponse.redirect(
            new URL(`/billing/subscription?reason=${reason}`, req.url),
          );
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (isPublicPath(req.nextUrl.pathname)) return true;
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
