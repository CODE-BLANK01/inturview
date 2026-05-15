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
        if (user.disabledAt) {
          // Disabled accounts can't sign in. NextAuth credentials provider can't return
          // a custom error message reliably; null = generic "Invalid credentials" UI.
          return null;
        }
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // Auto-promote if email is in ADMIN_EMAILS and not yet ADMIN.
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = ((user as { role?: Role }).role ?? Role.USER) as Role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { role?: Role }).role = (token.role as Role) ?? Role.USER;
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

export async function requireUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user as { id?: string; email?: string; name?: string | null; role?: Role } | undefined;
  if (!u?.id || !u.email) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    role: u.role ?? Role.USER,
  };
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await requireUser();
  if (!user || user.role !== Role.ADMIN) return null;
  return user;
}
