import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ interview_id: z.string().min(1) });

/**
 * Records that the candidate moved into the code phase BEFORE the interviewer
 * emitted [READY]. This is a behavioral signal — the debrief weighs it against
 * communication / approach_quality.
 */
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

  // Only flag if not already accepted — if the interviewer green-lit at any point,
  // don't retroactively mark it as a skip even if the user clicks the skip path.
  await prisma.interview.updateMany({
    where: {
      id: parsed.interview_id,
      userId: user.id,
      approachAcceptedAt: null,
    },
    data: { movedToCodeEarly: true },
  });

  return Response.json({ ok: true });
}
