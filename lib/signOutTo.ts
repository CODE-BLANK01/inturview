"use client";

import { signOut } from "next-auth/react";

/** Clear the NextAuth session, then navigate on the browser's current origin.
 *  We intentionally ignore NextAuth's returned URL because a stale
 *  NEXTAUTH_URL must never send a production user to localhost. */
export async function signOutTo(path: string = "/"): Promise<void> {
  await signOut({ redirect: false });
  window.location.assign(path);
}
