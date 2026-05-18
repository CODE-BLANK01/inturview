import type { AuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "./db";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

/** Comma-separated list of emails that are auto-promoted to ADMIN on signin/signup. */
export function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/signin" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (user.disabledAt) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        if (user.role !== Role.ADMIN && adminEmails().has(email)) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: Role.ADMIN },
          });
          user.role = Role.ADMIN;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          // Stamp the current token version into the issued JWT. Subsequent
          // requests verify this against the DB; if they mismatch, the session
          // is revoked.
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = ((user as { role?: Role }).role ?? Role.USER) as Role;
        token.ver = ((user as { tokenVersion?: number }).tokenVersion ?? 0) as number;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { role?: Role }).role = (token.role as Role) ?? Role.USER;
        (session.user as { tokenVersion?: number }).tokenVersion =
          (token.ver as number | undefined) ?? 0;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function auth() {
  return getServerSession(authOptions);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/**
 * Returns the authenticated user IFF:
 *   - a valid session JWT is present
 *   - the user row still exists
 *   - the user isn't disabled
 *   - the JWT's tokenVersion matches the DB's tokenVersion (revocation gate)
 *
 * Any mismatch returns null — the caller (page or API route) treats it as
 * "not signed in" and either redirects to /signin or returns 401. The stale
 * JWT cookie effectively becomes inert without us touching it.
 */
export async function requireUser(): Promise<SessionUser | null> {
  const session = await auth();
  const t = session?.user as
    | {
        id?: string;
        email?: string;
        name?: string | null;
        role?: Role;
        tokenVersion?: number;
      }
    | undefined;
  if (!t?.id || !t.email) return null;

  // The version the JWT was issued with (set in the session callback). Legacy
  // JWTs from before this column existed will be `undefined` — we treat that
  // as version 0, matching the schema default. Those legacy sessions keep
  // working until the user does any sensitive action — at which point the
  // DB tokenVersion is bumped to 1 and their cookie immediately becomes inert.
  const tokenVer = t.tokenVersion ?? 0;

  const row = await prisma.user.findUnique({
    where: { id: t.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabledAt: true,
      tokenVersion: true,
    },
  });
  if (!row) return null;
  if (row.disabledAt) return null;
  if (tokenVer !== row.tokenVersion) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await requireUser();
  if (!user || user.role !== Role.ADMIN) return null;
  return user;
}

/**
 * Bumps the user's tokenVersion, immediately invalidating every JWT issued
 * for them up to this moment. Call after password change, password reset,
 * role change, account disable, or self-serve "sign out everywhere".
 */
export async function bumpTokenVersion(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
