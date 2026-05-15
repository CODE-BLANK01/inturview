import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { UpdateProblemSchema } from "@/lib/adminSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const problem = await prisma.problem.findUnique({ where: { id: params.id } });
  if (!problem) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ problem });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let parsed;
  try {
    parsed = UpdateProblemSchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== "undefined") data[k] = v;
  }
  try {
    const updated = await prisma.problem.update({
      where: { id: params.id },
      data,
    });
    await writeAudit({
      adminId: admin.id,
      action: "PROBLEM_UPDATED",
      targetType: "problem",
      targetId: updated.id,
      metadata: { changed: Object.keys(data) },
    });
    return Response.json({ problem: updated });
  } catch {
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.problem.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, _count: { select: { interviews: true } } },
  });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  // Problem.interviews uses no cascade; refuse deletion if any interviews reference it.
  if (existing._count.interviews > 0) {
    return Response.json(
      {
        error: `Can't delete — ${existing._count.interviews} interview(s) reference this problem. Delete those first, or keep the problem.`,
      },
      { status: 409 }
    );
  }

  await prisma.problem.delete({ where: { id: params.id } });
  await writeAudit({
    adminId: admin.id,
    action: "PROBLEM_DELETED",
    targetType: "problem",
    targetId: existing.id,
    metadata: { title: existing.title },
  });
  return Response.json({ ok: true });
}
