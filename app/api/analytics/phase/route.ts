import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { captureProductEvent } from "@/lib/analytics";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("coding"), session_id: z.string().min(1), to: z.literal("code") }),
  z.object({ mode: z.literal("system_design"), session_id: z.string().min(1), to: z.literal("design") }),
]);

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid phase" }, { status: 400 });

  const { mode, session_id, to } = parsed.data;
  const enteredAt = new Date();
  const stamped = mode === "coding"
    ? await prisma.interview.updateMany({
        where: { id: session_id, userId: user.id, status: "IN_PROGRESS", codePhaseEnteredAt: null },
        data: { codePhaseEnteredAt: enteredAt },
      })
    : await prisma.designSession.updateMany({
        where: { id: session_id, userId: user.id, status: "IN_PROGRESS", designPhaseEnteredAt: null },
        data: { designPhaseEnteredAt: enteredAt },
      });
  if (stamped.count === 0) return new Response(null, { status: 204 });

  const sent = await captureProductEvent(user.id, {
    event: "phase_advanced",
    properties: { mode, session_id, from: mode === "coding" ? "approach" : "scope", to },
  });
  if (!sent) {
    // Retry on a later transition if PostHog was temporarily unavailable.
    if (mode === "coding") {
      await prisma.interview.updateMany({
        where: { id: session_id, codePhaseEnteredAt: enteredAt },
        data: { codePhaseEnteredAt: null },
      });
    } else {
      await prisma.designSession.updateMany({
        where: { id: session_id, designPhaseEnteredAt: enteredAt },
        data: { designPhaseEnteredAt: null },
      });
    }
  }
  return new Response(null, { status: 204 });
}
