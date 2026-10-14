import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { checkReadiness, LoopEditSchema } from "@/lib/loopTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = LoopEditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json({ error: issue ? `${issue.path.join(" › ")}: ${issue.message}` : "Invalid loop" }, { status: 400 });
  }
  const exists = await prisma.loopTemplate.count({ where: { id: params.id } });
  if (!exists) return Response.json({ error: "Loop not found" }, { status: 404 });
  const { rounds, ...meta } = parsed.data;
  await prisma.loopTemplate.update({
    where: { id: params.id },
    data: { ...meta, rounds: rounds as unknown as Prisma.InputJsonValue },
  });
  await writeAudit({ adminId: admin.id, action: "LOOP_UPDATED", targetType: "loop", targetId: params.id, metadata: { rounds: rounds.length } });
  // Tell the editor right away what still blocks publishing.
  return Response.json({ ok: true, ...(await checkReadiness(rounds)) });
}
