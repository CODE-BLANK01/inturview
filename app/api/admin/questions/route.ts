import { NextRequest } from "next/server";
import { QuestionCategory, QuestionSource, QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createQuestion, questionWhere, QuestionInputSchema } from "@/lib/questionBank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pick = <T extends string>(values: Record<string, T>, v: string | null) =>
  v && (Object.values(values) as string[]).includes(v) ? (v as T) : undefined;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const questions = await prisma.question.findMany({
    where: questionWhere({
      category: pick(QuestionCategory, sp.get("category")),
      status: pick(QuestionStatus, sp.get("status")),
      source: pick(QuestionSource, sp.get("source")),
      q: sp.get("q")?.trim() || undefined,
    }),
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    select: { id: true, category: true, title: true, status: true, source: true, currentVersion: true, tags: true, difficulty: true, updatedAt: true },
  });
  return Response.json({ questions });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = QuestionInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid question" }, { status: 400 });
  }
  const created = await createQuestion(parsed.data, { createdById: admin.id });
  await writeAudit({ adminId: admin.id, action: "QUESTION_CREATED", targetType: "question", targetId: created.id, metadata: { title: created.title } });
  return Response.json({ id: created.id }, { status: 201 });
}
