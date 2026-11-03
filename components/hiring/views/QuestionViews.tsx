// Question library screens, shared by Admin (the inturview library) and Hire
// workspaces (their own questions, plus the inturview library read-only).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { QuestionCategory, QuestionSource, QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS, hasUnpublishedChanges, questionWhere, type QuestionSnapshot } from "@/lib/questionBank";
import type { HiringPaths } from "@/lib/hiring/paths";
import { QuestionForm, type QuestionFormValue } from "../QuestionForm";
import { QuestionStatusActions } from "../QuestionStatusActions";
import { QuestionDraftForm } from "../QuestionDraftForm";

const STATUS_PILL: Record<QuestionStatus, string> = {
  PUBLISHED: "border-easy/40 bg-easy/10 text-easy",
  DRAFT: "border-medium/40 bg-medium/10 text-medium",
  RETIRED: "border-border bg-bg-inset text-text-dim",
};
const SOURCE_LABEL: Record<QuestionSource, string> = { SEED: "Built-in", ADMIN: "Written", AI_DRAFT: "AI draft", IMPORT: "Imported" };
const SOURCE_NOTE: Record<QuestionSource, string> = { SEED: "Built-in question", ADMIN: "Written by your team", AI_DRAFT: "Drafted by AI", IMPORT: "Imported" };

function one<T extends string>(values: Record<string, T>, v: string | string[] | undefined): T | undefined {
  return typeof v === "string" && (Object.values(values) as string[]).includes(v) ? (v as T) : undefined;
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

interface Scope {
  /** null: the inturview library (Admin). */
  organizationId: string | null;
  paths: HiringPaths;
}

export async function QuestionsView({ organizationId, paths, searchParams }: Scope & { searchParams: Record<string, string | string[] | undefined> }) {
  // In a workspace, ?library=1 browses the inturview library (read-only).
  const library = paths.workspace && searchParams.library === "1";
  const owner = library ? null : organizationId;
  const filters = {
    category: one(QuestionCategory, searchParams.category),
    status: library ? QuestionStatus.PUBLISHED : one(QuestionStatus, searchParams.status),
    source: library ? undefined : one(QuestionSource, searchParams.source),
    q: typeof searchParams.q === "string" && searchParams.q.trim() ? searchParams.q.trim() : undefined,
  };
  const [rows, byCategory, drafts] = await Promise.all([
    prisma.question.findMany({
      where: questionWhere(filters, owner),
      orderBy: [{ updatedAt: "desc" }],
      take: 300,
      select: { id: true, category: true, title: true, status: true, source: true, currentVersion: true, difficulty: true, updatedAt: true },
    }),
    prisma.question.groupBy({ by: ["category"], where: { organizationId: owner, status: "PUBLISHED" }, _count: true }),
    library ? 0 : prisma.question.count({ where: { organizationId: owner, status: "DRAFT" } }),
  ]);
  const published = Object.fromEntries(byCategory.map((r) => [r.category, r._count]));
  const base = library ? `${paths.questions}?library=1&` : `${paths.questions}?`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
          <p className="text-sm text-text-muted mt-1">
            {library
              ? "Questions written by inturview. Any of your loops can use them; only inturview can change them."
              : paths.workspace
                ? "Your company's questions. Only your workspace can see them. Nothing changes for candidates until you publish."
                : "The inturview library every workspace can use. Edit freely; nothing changes for candidates until you publish."}
          </p>
        </div>
        {!library && (
          <div className="flex gap-2">
            <Link href={`${paths.questions}/draft`} className="btn text-sm"><Sparkles className="h-4 w-4" /> Draft with AI</Link>
            <Link href={`${paths.questions}/new`} className="btn btn-primary text-sm"><Plus className="h-4 w-4" /> New question</Link>
          </div>
        )}
      </header>

      {paths.workspace && (
        <nav className="flex gap-1 border-b border-border text-sm" aria-label="Question libraries">
          {[
            { label: "Your questions", href: paths.questions, active: !library },
            { label: "inturview library", href: `${paths.questions}?library=1`, active: library },
          ].map((t) => (
            <Link
              key={t.label}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`px-3 py-2 -mb-px border-b-2 ${t.active ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.values(QuestionCategory).map((c) => (
          <Link key={c} href={`${base}category=${c}&status=PUBLISHED`} className="panel p-3 hover:border-accent/40">
            <div className="text-2xl font-semibold tabular-nums">{published[c] ?? 0}</div>
            <div className="text-xs text-text-dim">{CATEGORY_LABELS[c]}</div>
          </Link>
        ))}
        {!library && (
          <Link href={`${base}status=DRAFT`} className="panel p-3 hover:border-accent/40">
            <div className="text-2xl font-semibold tabular-nums">{drafts}</div>
            <div className="text-xs text-text-dim">Drafts to review</div>
          </Link>
        )}
      </div>

      <form className="flex flex-wrap gap-2 items-end" action={paths.questions}>
        {library && <input type="hidden" name="library" value="1" />}
        <input id="f-q" name="q" defaultValue={filters.q} className="input w-56" placeholder="Search title, text or tag" aria-label="Search questions" />
        <select id="f-category" name="category" defaultValue={filters.category ?? ""} className="input w-48" aria-label="Category">
          <option value="">All categories</option>
          {Object.values(QuestionCategory).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        {!library && (
          <>
            <select id="f-status" name="status" defaultValue={filters.status ?? ""} className="input w-36" aria-label="Status">
              <option value="">Any status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="RETIRED">Retired</option>
            </select>
            <select id="f-source" name="source" defaultValue={filters.source ?? ""} className="input w-36" aria-label="Source">
              <option value="">Any source</option>
              {Object.values(QuestionSource).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
            </select>
          </>
        )}
        <button className="btn text-sm" type="submit">Filter</button>
        {(filters.q || filters.category || (!library && (filters.status || filters.source))) && (
          <Link href={library ? `${paths.questions}?library=1` : paths.questions} className="text-sm text-text-dim hover:text-text px-2 py-2">Clear</Link>
        )}
      </form>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Question", "Category", ...(library ? [] : ["Status", "Source"]), "Version"].map((h) => (
                  <th key={h} className={`font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 ${h === "Version" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-b border-border last:border-0 hover:bg-bg-inset/50">
                  <td className="px-4 py-3">
                    <Link href={`${paths.questions}/${q.id}`} className="font-medium hover:underline underline-offset-2">{q.title}</Link>
                    {q.difficulty && <span className="ml-2 text-xs text-text-dim">{q.difficulty}</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{CATEGORY_LABELS[q.category]}</td>
                  {!library && (
                    <>
                      <td className="px-4 py-3"><span className={`badge ${STATUS_PILL[q.status]}`}>{q.status.toLowerCase()}</span></td>
                      <td className="px-4 py-3 text-text-muted">{SOURCE_LABEL[q.source]}</td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">{q.currentVersion || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={library ? 3 : 5} className="text-center text-text-dim py-8">
                    {library ? "No library questions match." : "No questions match. Clear the filters, or draft some with AI."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export async function QuestionDetailView({ organizationId, paths, id }: Scope & { id: string }) {
  const q = await prisma.question.findFirst({
    // A workspace can open its own questions, and read published library ones.
    where: organizationId
      ? { id, OR: [{ organizationId }, { organizationId: null, status: QuestionStatus.PUBLISHED }] }
      : { id, organizationId: null },
    include: { versions: { orderBy: { version: "desc" }, take: 20 } },
  });
  if (!q) notFound();

  if (q.organizationId !== organizationId) {
    return (
      <div className="space-y-6">
        <BackLink href={`${paths.questions}?library=1`} label="inturview library" />
        <header>
          <p className="text-xs uppercase tracking-[0.08em] text-text-dim">{CATEGORY_LABELS[q.category]} · inturview library · version {q.currentVersion}</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{q.title}</h1>
        </header>
        <div className="panel p-5 space-y-4 max-w-3xl text-sm">
          <p className="whitespace-pre-wrap">{q.prompt}</p>
          {q.followUps.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-[0.08em] text-text-dim mb-1">Follow-ups</h2>
              <ul className="list-disc pl-5 space-y-0.5">{q.followUps.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
          {q.signals.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-[0.08em] text-text-dim mb-1">What a strong answer shows</h2>
              <ul className="list-disc pl-5 space-y-0.5">{q.signals.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-text-dim">Add it to a round in any of your loops. To change it, write your own version in your library.</p>
        </div>
      </div>
    );
  }

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
      <BackLink href={paths.questions} label="Questions" />
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

export function QuestionNewView({ paths }: { paths: HiringPaths }) {
  return (
    <div className="space-y-6">
      <BackLink href={paths.questions} label="Questions" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New question</h1>
        <p className="text-sm text-text-muted mt-1">Saved as a draft. Publish it when it&apos;s ready for loops.</p>
      </header>
      <QuestionForm />
    </div>
  );
}

export function QuestionDraftView({ paths }: { paths: HiringPaths }) {
  return (
    <div className="space-y-6">
      <BackLink href={paths.questions} label="Questions" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Draft questions with AI</h1>
        <p className="text-sm text-text-muted mt-1">
          Paste a job description and get original questions written for that role. Everything lands as a draft for you
          to edit and publish.
        </p>
      </header>
      <QuestionDraftForm />
    </div>
  );
}
