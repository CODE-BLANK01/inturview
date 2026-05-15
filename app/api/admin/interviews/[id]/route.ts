import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const interview = await prisma.interview.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, problemId: true },
  });
  if (!interview) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.interview.delete({ where: { id: params.id } });
  await writeAudit({
    adminId: admin.id,
    action: "INTERVIEW_DELETED",
    targetType: "interview",
    targetId: interview.id,
    metadata: { userId: interview.userId, problemId: interview.problemId },
  });
  return Response.json({ ok: true });
}
