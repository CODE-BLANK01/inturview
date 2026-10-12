import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { liveRatesPerMinute } from "@/lib/aiCost";
import { checkReadiness, parseRounds } from "@/lib/loopTemplates";
import { LoopBuilder } from "@/components/admin/LoopBuilder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit loop — inturview admin" };

export default async function EditLoopPage({ params }: { params: { id: string } }) {
  const loop = await prisma.loopTemplate.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { version: "desc" }, take: 10, select: { id: true, version: true, publishedAt: true } } },
  });
  if (!loop) notFound();

  const rounds = parseRounds(loop.rounds);
  const fixedIds = rounds.flatMap((r) => (r.questions.mode === "fixed" ? r.questions.questionIds : []));
  const [titles, readiness] = await Promise.all([
    fixedIds.length ? prisma.question.findMany({ where: { id: { in: fixedIds } }, select: { id: true, title: true } }) : [],
    checkReadiness(rounds),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin/loops" className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Loops
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{loop.name}</h1>
        {loop.versions.length > 0 && (
          <p className="text-xs text-text-dim">
            Versions: {loop.versions.map((v) => `v${v.version} (${v.publishedAt.toISOString().slice(0, 10)})`).join(" · ")}
          </p>
        )}
      </header>
      <LoopBuilder
        loopId={loop.id}
        initial={{
          name: loop.name,
          description: loop.description,
          roleTarget: loop.roleTarget,
          level: (loop.level as "junior" | "mid" | "senior" | null) ?? null,
          rounds,
        }}
        questionTitles={Object.fromEntries(titles.map((t) => [t.id, t.title]))}
        rates={liveRatesPerMinute()}
        initialProblems={readiness.problems}
        status={loop.status}
        version={loop.currentVersion}
      />
    </div>
  );
}
