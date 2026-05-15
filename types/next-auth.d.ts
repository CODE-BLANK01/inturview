import { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; role: Role };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
  }
}
