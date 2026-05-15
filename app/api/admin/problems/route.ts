import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { CreateProblemSchema } from "@/lib/adminSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const problems = await prisma.problem.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      difficulty: true,
      topic: true,
      _count: { select: { interviews: true } },
    },
  });
  return Response.json({ problems });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let parsed;
  try {
    parsed = CreateProblemSchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.problem.create({
      data: {
        id: parsed.id,
        title: parsed.title,
        difficulty: parsed.difficulty,
        topic: parsed.topic,
        leetcodeUrl: parsed.leetcodeUrl,
        description: parsed.description,
        examples: parsed.examples,
        constraints: parsed.constraints,
        optimalTime: parsed.optimalTime,
        optimalSpace: parsed.optimalSpace,
        tags: parsed.tags,
      },
    });
    await writeAudit({
      adminId: admin.id,
      action: "PROBLEM_CREATED",
      targetType: "problem",
      targetId: created.id,
      metadata: { title: created.title },
    });
    return Response.json({ problem: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return Response.json(
        { error: `A problem with id "${parsed.id}" already exists.` },
        { status: 409 }
      );
    }
    return Response.json({ error: "Could not create problem" }, { status: 500 });
  }
}
