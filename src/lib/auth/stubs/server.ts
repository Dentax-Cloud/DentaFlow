import { NextResponse, type NextRequest } from "next/server";

export type AuthResult = {
  userId: string | null;
  orgId: string | null;
};

/** Placeholder until a real auth provider is wired (e.g. NextAuth). */
export async function auth(): Promise<AuthResult> {
  return { userId: null, orgId: null };
}

/** Placeholder — no authenticated user profile without a real provider. */
export async function currentUser(): Promise<null> {
  return null;
}

type OrgMembership = {
  organization: { id: string; name: string };
  role?: string;
  publicMetadata?: unknown;
};

type OrgInvitation = {
  id: string;
  emailAddress: string;
  role?: string;
  publicMetadata?: unknown;
  createdAt: number;
};

type MembershipList = { data: OrgMembership[] };
type InvitationList = { data: OrgInvitation[] };

/** Minimal Clerk SDK surface used by existing call sites. */
export type ClerkClientStub = {
  users: {
    getOrganizationMembershipList: (_args: { userId: string }) => Promise<MembershipList>;
  };
  organizations: {
    createOrganization: (_args: Record<string, unknown>) => Promise<{ id: string }>;
    getOrganizationInvitationList: (_args: Record<string, unknown>) => Promise<InvitationList>;
    createOrganizationInvitation: (_args: Record<string, unknown>) => Promise<{ id: string }>;
    updateOrganizationMembership: (_args: Record<string, unknown>) => Promise<void>;
    deleteOrganizationMembership: (_args: Record<string, unknown>) => Promise<void>;
    updateOrganizationMembershipMetadata: (_args: Record<string, unknown>) => Promise<void>;
    createOrganizationMembership: (_args: Record<string, unknown>) => Promise<void>;
  };
};

const clerkClientStub: ClerkClientStub = {
  users: {
    getOrganizationMembershipList: async () => ({ data: [] }),
  },
  organizations: {
    createOrganization: async () => ({ id: "stub_org_id" }),
    getOrganizationInvitationList: async () => ({ data: [] }),
    createOrganizationInvitation: async () => ({ id: "stub_invite_id" }),
    updateOrganizationMembership: async () => {},
    deleteOrganizationMembership: async () => {},
    updateOrganizationMembershipMetadata: async () => {},
    createOrganizationMembership: async () => {},
  },
};

export async function clerkClient(): Promise<ClerkClientStub> {
  return clerkClientStub;
}

function matchPattern(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("(.*)")) {
    const prefix = pattern.slice(0, -4);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return pathname === pattern;
}

/** Local replacement for Clerk's route matcher (no SDK). */
export function createRouteMatcher(patterns: string[]) {
  return (req: NextRequest) =>
    patterns.some((pattern) => matchPattern(req.nextUrl.pathname, pattern));
}

type AuthFn = () => Promise<AuthResult>;

/** Local replacement for Clerk middleware wrapper (no SDK). */
export function clerkMiddleware(
  handler: (auth: AuthFn, req: NextRequest) => Promise<Response | NextResponse | undefined>,
) {
  return async (req: NextRequest) => {
    const authFn: AuthFn = () => auth();
    const result = await handler(authFn, req);
    return result ?? NextResponse.next();
  };
}
