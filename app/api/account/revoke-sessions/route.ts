import { NextRequest } from "next/server";
import { bumpTokenVersion, requireUser } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-serve "Sign out everywhere". Bumps the caller's tokenVersion, which
 * immediately invalidates every outstanding JWT for the account — including
 * the current one. The client should call signOut() after a successful
 * response so the now-inert cookie is dropped cleanly.
 */
export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  // Light limit — clicking "Sign out everywhere" repeatedly should be no-op safe
  // but we cap it to prevent someone spamming the revoke counter.
  const key = clientKey(req.headers);
  const rl = checkRateLimit({
    key: `revoke:${user.id}:${key}`,
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  await bumpTokenVersion(user.id);
  return Response.json({ ok: true });
}
