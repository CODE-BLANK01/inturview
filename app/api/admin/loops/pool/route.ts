import { NextRequest } from "next/server";
import { z } from "zod";
import { QuestionCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { LEVELS } from "@/lib/questionBank";
import { poolWhere } from "@/lib/loopTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tags = z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10).default([]);
const Body = z.object({ category: z.nativeEnum(QuestionCategory), tags, roles: tags, level: z.enum(LEVELS).nullable().default(null) });

/** How many published questions a pool round would draw from, with a few examples. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid pool" }, { status: 400 });
  const where = poolWhere(parsed.data.category, parsed.data);
  const [count, sample] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({ where, take: 4, orderBy: { updatedAt: "desc" }, select: { title: true } }),
  ]);
  return Response.json({ count, sample: sample.map((q) => q.title) });
}
