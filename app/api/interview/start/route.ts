import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getProblem } from "@/lib/problems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ problem_id: z.string().min(1) });

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

  // Make sure the problem exists in the DB (seeded). If for some reason it isn't
  // (fresh DB without seeding), fall back to inserting from the static list.
  const problemRow = await prisma.problem.findUnique({ where: { id: parsed.problem_id } });
  if (!problemRow) {
    const p = getProblem(parsed.problem_id);
    if (!p) return Response.json({ error: "Unknown problem" }, { status: 404 });
    await prisma.problem.create({
      data: {
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        topic: p.topic,
        leetcodeUrl: p.leetcode_url,
        description: p.description,
        examples: p.examples,
        constraints: p.constraints,
        optimalTime: p.optimal_time,
        optimalSpace: p.optimal_space,
        tags: p.tags,
      },
    });
  }

  const interview = await prisma.interview.create({
    data: {
      userId: user.id,
      problemId: parsed.problem_id,
    },
    select: { id: true, startedAt: true },
  });

  return Response.json(interview, { status: 201 });
}
