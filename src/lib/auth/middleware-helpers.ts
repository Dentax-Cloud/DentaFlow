const PUBLIC_PATHS = ["/", "/login", "/features", "/portal", "/maintenance"];
const PUBLIC_PREFIXES = [
  "/api/health",
  "/api/auth",
  "/api/webhooks",
  "/api/uploadthing", // UploadThing webhook must be unauthenticated (no session cookie)
  "/api/platform/maintenance",
  "/sign-up",
  "/invite/accept",
  "/verify-email",
  "/plan",
  "/visit",
  "/case",
  "/consent",
  "/education",
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/portal/")) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith("/sign-up")) return true;
  if (pathname.startsWith("/sign-in")) return true;
  return false;
}

export function isSuperAdminPath(pathname: string): boolean {
  return (
    pathname === "/superadmin" ||
    pathname.startsWith("/superadmin/") ||
    pathname === "/super-admin" ||
    pathname.startsWith("/super-admin/")
  );
}

export function isTenantPath(pathname: string): boolean {
  return pathname.startsWith("/t/");
}

/** App routes that require an active subscription/trial. */
export function isProtectedTenantAppRoute(pathname: string): boolean {
  const prefixes = [
    "/dashboard",
    "/patients",
    "/appointments",
    "/clinical",
    "/billing",
    "/crm",
    "/reports",
    "/inventory",
    "/admin",
    "/ai",
  ];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function extractTenantSlug(pathname: string): string | null {
  const match = pathname.match(/^\/t\/([^/]+)/);
  return match?.[1] ?? null;
}

/** @deprecated Use isPublicPath */
export const isPublicRoute = isPublicPath;
