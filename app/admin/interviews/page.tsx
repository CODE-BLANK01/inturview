import { prisma } from "@/lib/db";
import {
  InterviewsTable,
  type AdminInterviewRow,
} from "@/components/admin/InterviewsTable";

export const dynamic = "force-dynamic";

type Status = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export default async function AdminInterviewsPage({
  searchParams,
}: {
  searchParams: { status?: Status };
}) {
  const status = searchParams.status;

  const rows = await prisma.interview.findMany({
    where: status ? { status } : undefined,
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      totalScore: true,
      recommendation: true,
      startedAt: true,
      completedAt: true,
      approachAcceptedAt: true,
      movedToCodeEarly: true,
      user: { select: { email: true } },
      problem: { select: { title: true } },
    },
  });

  const mapped: AdminInterviewRow[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    totalScore: r.totalScore,
    recommendation: r.recommendation,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    approachAcceptedAt: r.approachAcceptedAt?.toISOString() ?? null,
    movedToCodeEarly: r.movedToCodeEarly,
    userEmail: r.user.email,
    problemTitle: r.problem.title,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
        <p className="text-sm text-text-muted mt-1">
          Every interview across users. View transcript + scorecard, or remove abusive
          sessions. Showing latest {mapped.length}.
        </p>
      </header>
      <InterviewsTable rows={mapped} />
    </div>
  );
}
