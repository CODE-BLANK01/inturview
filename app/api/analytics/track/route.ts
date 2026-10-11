import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { captureProductEvent, type ProductEvent } from "@/lib/analytics";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Only these events may come from the browser. Everything else is server-side,
// where the server decides what happened.
const category = z.enum(["coding", "system_design", "behavioral", "recruiter_screen", "face_to_face"]);
const sessionId = z.string().min(1).max(64);
const Body = z.object({
  anonymous_id: z.string().regex(/^anon_[a-z0-9]{8,40}$/).optional(),
  data: z.discriminatedUnion("event", [
    z.object({ event: z.literal("page_viewed"), properties: z.object({ path: z.string().startsWith("/").max(200) }) }),
    z.object({ event: z.literal("signup_started") }),
    z.object({ event: z.literal("debrief_viewed"), properties: z.object({ mode: category, session_id: sessionId }) }),
    z.object({ event: z.literal("avatar_connected"), properties: z.object({ session_id: sessionId }) }),
    z.object({
      event: z.literal("avatar_fallback"),
      properties: z.object({ session_id: sessionId, reason: z.enum(["unavailable", "ended"]) }),
    }),
  ]),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit({ key: `track:${clientKey(req.headers)}`, limit: 120, windowMs: 60_000 });
  if (!rl.ok) return new Response(null, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });

  // Strip query strings and fragments: tokens live there (reset links, verification).
  const data = parsed.data.data as ProductEvent;
  if (data.event === "page_viewed") data.properties.path = data.properties.path.split(/[?#]/)[0];

  const user = await requireUser().catch(() => null);
  const distinctId = user?.id ?? parsed.data.anonymous_id;
  if (!distinctId) return new Response(null, { status: 400 });

  await captureProductEvent(distinctId, data);
  return new Response(null, { status: 204 });
}
