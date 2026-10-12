import { NextRequest } from "next/server";
import { z } from "zod";
import { QuestionCategory, QuestionSource } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";
import { createQuestion } from "@/lib/questionBank";
import { DRAFT_MODEL, generateDrafts } from "@/lib/questionDrafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Drafting a handful of questions can take 20–60 seconds.
export const maxDuration = 60;

const Body = z.object({
  jobDescription: z.string().trim().min(40, "Paste at least a few lines of the job description.").max(12_000),
  categories: z.array(z.nativeEnum(QuestionCategory)).min(1, "Pick at least one category."),
  count: z.number().int().min(1).max(8).default(5),
  level: z.enum(["junior", "mid", "senior"]).nullable().default(null),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const rl = checkRateLimit({ key: `qdraft:${admin.id}`, limit: 12, windowMs: 60 * 60_000 });
  if (!rl.ok) return Response.json({ error: "Drafting limit reached. Try again in an hour." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  let result;
  try {
    result = await generateDrafts(parsed.data);
  } catch (e) {
    console.error("[admin/questions/draft] model call failed:", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't reach the model. Try again in a minute." }, { status: 502 });
  }
  if (result.drafts.length === 0) {
    return Response.json(
      { error: "The model's reply couldn't be used. Try again, or shorten the job description.", rejected: result.rejected },
      { status: 422 },
    );
  }

  const ids: string[] = [];
  for (const draft of result.drafts) {
    const q = await createQuestion(draft, { createdById: admin.id, source: QuestionSource.AI_DRAFT });
    ids.push(q.id);
  }
  await writeAudit({
    adminId: admin.id,
    action: "QUESTIONS_DRAFTED",
    targetType: "question",
    targetId: ids[0]!,
    metadata: { ids, model: DRAFT_MODEL, rejected: result.rejected.length, costUsd: result.costUsd, stopReason: result.stopReason },
  });
  return Response.json({ ids, rejected: result.rejected, costUsd: result.costUsd }, { status: 201 });
}
