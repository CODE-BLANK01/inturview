import { NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { findInviteByToken, recordConsent } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit({ key: `invite-consent:${clientKey(req.headers)}`, limit: 30, windowMs: 10 * 60_000 });
  if (!rl.ok) return Response.json({ error: "Too many attempts. Wait a few minutes." }, { status: 429 });
  const parsed = z.object({ token: z.string().min(20).max(100) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid link" }, { status: 400 });
  const found = await findInviteByToken(parsed.data.token);
  if (!found.ok) return Response.json({ error: "This link no longer works." }, { status: 410 });
  await recordConsent(found.invite.id);
  return Response.json({ ok: true });
}
