import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { scoreRound } from "@/lib/loopRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Re-runs grading for a round whose scoring failed or needs another look. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const rr = await prisma.loopRoundRun.findUnique({ where: { id: params.id }, select: { status: true, run: { select: { userId: true } } } });
  if (!rr) return Response.json({ error: "Round not found" }, { status: 404 });
  if (rr.status === "IN_PROGRESS") return Response.json({ error: "The candidate hasn't finished this round yet." }, { status: 409 });
  const updated = await scoreRound(params.id, rr.run.userId ?? admin.id);
  await writeAudit({ adminId: admin.id, action: "ROUND_RESCORED", targetType: "invite", targetId: params.id, metadata: { status: updated.status } });
  return updated.status === "COMPLETED" ? Response.json({ ok: true, score: updated.score }) : Response.json({ error: "Grading failed again. Try in a minute." }, { status: 502 });
}
