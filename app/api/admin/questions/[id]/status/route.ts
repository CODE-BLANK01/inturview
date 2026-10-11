import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { publishQuestion, QuestionRetiredError, restoreQuestion, retireQuestion } from "@/lib/questionBank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["publish", "retire", "restore"]) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown action" }, { status: 400 });
  const exists = await prisma.question.count({ where: { id: params.id } });
  if (!exists) return Response.json({ error: "Question not found" }, { status: 404 });

  const { action } = parsed.data;
  if (action === "publish") {
    try {
      const q = await publishQuestion(params.id, admin.id);
      await writeAudit({ adminId: admin.id, action: "QUESTION_PUBLISHED", targetType: "question", targetId: params.id, metadata: { version: q.currentVersion } });
      return Response.json({ status: q.status, version: q.currentVersion });
    } catch (e) {
      if (e instanceof QuestionRetiredError) return Response.json({ error: e.message }, { status: 409 });
      // P2002: someone published the same version a moment ago.
      if ((e as { code?: string }).code === "P2002") return Response.json({ error: "Already published. Refresh to see the latest version." }, { status: 409 });
      throw e;
    }
  }
  const q = action === "retire" ? await retireQuestion(params.id) : await restoreQuestion(params.id);
  await writeAudit({ adminId: admin.id, action: action === "retire" ? "QUESTION_RETIRED" : "QUESTION_RESTORED", targetType: "question", targetId: params.id });
  return Response.json({ status: q.status, version: q.currentVersion });
}
