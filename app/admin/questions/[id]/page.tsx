import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS, hasUnpublishedChanges, type QuestionSnapshot } from "@/lib/questionBank";
import { QuestionForm, type QuestionFormValue } from "@/components/admin/QuestionForm";
import { QuestionStatusActions } from "@/components/admin/QuestionStatusActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit question — inturview admin" };

const SOURCE_NOTE = { SEED: "Built-in question", ADMIN: "Written by your team", AI_DRAFT: "Drafted by AI", IMPORT: "Imported" } as const;

export default async function EditQuestionPage({ params }: { params: { id: string } }) {
  const q = await prisma.question.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { version: "desc" }, take: 20 } },
  });
  if (!q) notFound();

  const latest = (q.versions[0]?.snapshot ?? null) as QuestionSnapshot | null;
  const unpublished = hasUnpublishedChanges(q as unknown as QuestionSnapshot, latest);
  const initial: QuestionFormValue = {
    category: q.category,
    title: q.title,
    prompt: q.prompt,
    followUps: q.followUps,
    signals: q.signals,
    levels: q.levels,
    roles: q.roles,
    tags: q.tags,
    difficulty: (q.difficulty as QuestionFormValue["difficulty"]) ?? null,
    details: q.details,
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/questions" className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Questions
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.08em] text-text-dim">{CATEGORY_LABELS[q.category]} · {SOURCE_NOTE[q.source]}</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{q.title}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
        <QuestionForm questionId={q.id} initial={initial} />
        <aside className="space-y-4 lg:sticky lg:top-6">
          <QuestionStatusActions questionId={q.id} status={q.status} version={q.currentVersion} unpublishedChanges={unpublished} />
          <div className="panel p-4">
            <h2 className="text-sm font-medium mb-2">Version history</h2>
            {q.versions.length === 0 ? (
              <p className="text-sm text-text-dim">Never published.</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {q.versions.map((v) => (
                  <li key={v.id} className="flex justify-between gap-3">
                    <span>Version {v.version}</span>
                    <span className="text-text-dim tabular-nums">{v.publishedAt.toISOString().slice(0, 10)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
