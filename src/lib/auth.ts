import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

export function resolveIsSuperAdmin(userId: string): boolean {
  const envIds = (process.env.SUPER_ADMIN_AUTH_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (envIds.includes(userId)) return true;
  return false;
}

async function loadMembershipContext(userId: string, preferredTenantId?: string | null) {
  const [memberships, authUser] = await Promise.all([
    db.tenant_memberships.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    db.auth_users.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true, activeTenantId: true },
    }),
  ]);

  const active =
    memberships.find((m) => m.tenantId === authUser?.activeTenantId) ??
    memberships.find((m) => m.tenantId === preferredTenantId) ??
    memberships[0] ??
    null;

  const activeTenantId = active?.tenantId ?? authUser?.activeTenantId ?? null;

  let subscriptionStatus: string | null = null;
  let tenantStatus: string | null = null;
  if (activeTenantId) {
    const tenant = await db.tenant.findUnique({
      where: { id: activeTenantId },
      select: { subscriptionStatus: true, status: true },
    });
    subscriptionStatus = tenant?.subscriptionStatus ?? null;
    tenantStatus = tenant?.status ?? null;
  }

  return {
    activeTenantId,
    role: active?.role ?? null,
    isSuperAdmin: resolveIsSuperAdmin(userId) || (authUser?.isSuperAdmin ?? false),
    subscriptionStatus,
    tenantStatus,
  };
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await db.auth_users.findUnique({
        where: { email: credentials.email.toLowerCase().trim() },
      });
      if (!user?.passwordHash) return null;

      const valid = await compare(credentials.password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
    newUser: "/onboarding",
  },
  providers,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const userId = (user?.id ?? token.userId) as string;
      if (!userId) return token;

      token.userId = userId;

      const preferredTenantId =
        trigger === "update" && session?.activeTenantId !== undefined
          ? (session.activeTenantId as string | null)
          : (token.activeTenantId as string | null);

      const ctx = await loadMembershipContext(userId, preferredTenantId);
      token.activeTenantId = ctx.activeTenantId;
      // Legacy membership role — not used for RBAC; permissions use StaffMember.role (see staff-role.ts).
      token.role = ctx.role;
      token.isSuperAdmin = ctx.isSuperAdmin;
      token.subscriptionStatus = ctx.subscriptionStatus;
      token.tenantStatus = ctx.tenantStatus;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.activeTenantId = token.activeTenantId;
        // Legacy membership role — not used for RBAC; permissions use StaffMember.role (see staff-role.ts).
        session.user.role = token.role;
        session.user.isSuperAdmin = token.isSuperAdmin;
        session.user.subscriptionStatus = token.subscriptionStatus;
        session.user.tenantStatus = token.tenantStatus;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
};

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<string> {
  const session = await requireAuth();
  if (!session.user.isSuperAdmin) {
    throw new Error("FORBIDDEN");
  }
  return session.user.id;
}

export async function getCurrentUser() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return null;
  return db.auth_users.findUnique({ where: { id: session.user.id } });
}
