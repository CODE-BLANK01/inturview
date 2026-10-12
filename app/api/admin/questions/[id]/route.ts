import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { QuestionInputSchema, updateQuestion } from "@/lib/questionBank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { version: "desc" }, select: { version: true, publishedAt: true, publishedById: true } } },
  });
  if (!question) return Response.json({ error: "Question not found" }, { status: 404 });
  return Response.json({ question });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = QuestionInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid question" }, { status: 400 });
  }
  const exists = await prisma.question.count({ where: { id: params.id } });
  if (!exists) return Response.json({ error: "Question not found" }, { status: 404 });
  await updateQuestion(params.id, parsed.data);
  await writeAudit({ adminId: admin.id, action: "QUESTION_UPDATED", targetType: "question", targetId: params.id });
  return Response.json({ ok: true });
}
