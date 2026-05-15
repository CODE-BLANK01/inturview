import { prisma } from "@/lib/db";
import { ProblemsTable, type AdminProblemRow } from "@/components/admin/ProblemsTable";
import type { Difficulty } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProblemsPage() {
  const rows = await prisma.problem.findMany({
    orderBy: [{ topic: "asc" }, { difficulty: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      difficulty: true,
      topic: true,
      _count: { select: { interviews: true } },
    },
  });

  const mapped: AdminProblemRow[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty as Difficulty,
    topic: p.topic,
    interviewsCount: p._count.interviews,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
        <p className="text-sm text-text-muted mt-1">
          Manage the problem catalog. Deleting a problem is blocked while interviews reference it.
        </p>
      </header>
      <ProblemsTable rows={mapped} />
    </div>
  );
}
