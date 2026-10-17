import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { captureProductEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ session_id: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  const result = await prisma.conversationSession.updateMany({
    where: { id: parsed.session_id, userId: user.id, status: "IN_PROGRESS" },
    data: { status: "ABANDONED", completedAt: new Date() },
  });

  if (result.count > 0) {
    const ended = await prisma.conversationSession.findUnique({
      where: { id: parsed.session_id },
      select: { kind: true },
    });
    if (ended) {
      await captureProductEvent(user.id, {
        event: "session_abandoned",
        properties: {
          mode: ended.kind.toLowerCase() as "behavioral" | "recruiter_screen" | "face_to_face",
          session_id: parsed.session_id,
        },
      });
    }
  }
  return Response.json({ ok: true, updated: result.count });
}
