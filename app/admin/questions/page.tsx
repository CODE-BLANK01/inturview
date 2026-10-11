import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { QuestionCategory, QuestionSource, QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS, questionWhere } from "@/lib/questionBank";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questions — inturview admin" };

const STATUS_PILL: Record<QuestionStatus, string> = {
  PUBLISHED: "border-easy/40 bg-easy/10 text-easy",
  DRAFT: "border-medium/40 bg-medium/10 text-medium",
  RETIRED: "border-border bg-bg-inset text-text-dim",
};
const SOURCE_LABEL: Record<QuestionSource, string> = { SEED: "Built-in", ADMIN: "Written", AI_DRAFT: "AI draft", IMPORT: "Imported" };

function one<T extends string>(values: Record<string, T>, v: string | string[] | undefined): T | undefined {
  return typeof v === "string" && (Object.values(values) as string[]).includes(v) ? (v as T) : undefined;
}

export default async function AdminQuestionsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = {
    category: one(QuestionCategory, searchParams.category),
    status: one(QuestionStatus, searchParams.status),
    source: one(QuestionSource, searchParams.source),
    q: typeof searchParams.q === "string" && searchParams.q.trim() ? searchParams.q.trim() : undefined,
  };
  const [rows, byCategory, drafts] = await Promise.all([
    prisma.question.findMany({
      where: questionWhere(filters),
      orderBy: [{ updatedAt: "desc" }],
      take: 300,
      select: { id: true, category: true, title: true, status: true, source: true, currentVersion: true, difficulty: true, updatedAt: true },
    }),
    prisma.question.groupBy({ by: ["category"], where: { organizationId: null, status: "PUBLISHED" }, _count: true }),
    prisma.question.count({ where: { organizationId: null, status: "DRAFT" } }),
  ]);
  const published = Object.fromEntries(byCategory.map((r) => [r.category, r._count]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
          <p className="text-sm text-text-muted mt-1">
            The library loops pick from. Edit freely; nothing changes for candidates until you publish.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/questions/draft" className="btn text-sm"><Sparkles className="h-4 w-4" /> Draft with AI</Link>
          <Link href="/admin/questions/new" className="btn btn-primary text-sm"><Plus className="h-4 w-4" /> New question</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.values(QuestionCategory).map((c) => (
          <Link key={c} href={`/admin/questions?category=${c}&status=PUBLISHED`} className="panel p-3 hover:border-accent/40">
            <div className="text-2xl font-semibold tabular-nums">{published[c] ?? 0}</div>
            <div className="text-xs text-text-dim">{CATEGORY_LABELS[c]}</div>
          </Link>
        ))}
        <Link href="/admin/questions?status=DRAFT" className="panel p-3 hover:border-accent/40">
          <div className="text-2xl font-semibold tabular-nums">{drafts}</div>
          <div className="text-xs text-text-dim">Drafts to review</div>
        </Link>
      </div>

      <form className="flex flex-wrap gap-2 items-end" action="/admin/questions">
        <input id="f-q" name="q" defaultValue={filters.q} className="input w-56" placeholder="Search title, text or tag" />
        <select id="f-category" name="category" defaultValue={filters.category ?? ""} className="input w-48">
          <option value="">All categories</option>
          {Object.values(QuestionCategory).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select id="f-status" name="status" defaultValue={filters.status ?? ""} className="input w-36">
          <option value="">Any status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="RETIRED">Retired</option>
        </select>
        <select id="f-source" name="source" defaultValue={filters.source ?? ""} className="input w-36">
          <option value="">Any source</option>
          {Object.values(QuestionSource).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
        <button className="btn text-sm" type="submit">Filter</button>
        {(filters.q || filters.category || filters.status || filters.source) && (
          <Link href="/admin/questions" className="text-sm text-text-dim hover:text-text px-2 py-2">Clear</Link>
        )}
      </form>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Question</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Category</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Status</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">Source</th>
                <th className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 text-right">Version</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-b border-border last:border-0 hover:bg-bg-inset/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/questions/${q.id}`} className="font-medium hover:underline underline-offset-2">{q.title}</Link>
                    {q.difficulty && <span className="ml-2 text-xs text-text-dim">{q.difficulty}</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{CATEGORY_LABELS[q.category]}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_PILL[q.status]}`}>{q.status.toLowerCase()}</span></td>
                  <td className="px-4 py-3 text-text-muted">{SOURCE_LABEL[q.source]}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">{q.currentVersion || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-text-dim py-8">No questions match. Clear the filters, or draft some with AI.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
