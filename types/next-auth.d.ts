import { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      /** Set on signin from the DB. Compared against the DB on every protected
       *  request so bumping the user's tokenVersion revokes every outstanding JWT. */
      tokenVersion: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    ver?: number;
  }
}
