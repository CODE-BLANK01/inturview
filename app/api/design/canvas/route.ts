import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  session_id: z.string().min(1),
  // Excalidraw scene JSON — capped to keep DB rows sane. Plenty for a 45-min
  // session even with hundreds of elements.
  canvas: z.string().max(1_500_000),
});

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

  let canvasJson: unknown;
  try {
    canvasJson = JSON.parse(parsed.canvas);
  } catch {
    return Response.json({ error: "Canvas is not valid JSON" }, { status: 400 });
  }

  const result = await prisma.designSession.updateMany({
    where: { id: parsed.session_id, userId: user.id, status: "IN_PROGRESS" },
    data: { canvasJson: canvasJson as never },
  });
  if (result.count === 0) {
    return Response.json({ error: "Session not found or already completed" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
