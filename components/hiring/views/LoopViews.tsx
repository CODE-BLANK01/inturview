// Loop screens, shared by Admin (inturview templates) and Hire workspaces.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { LoopStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { liveRatesPerMinute } from "@/lib/aiCost";
import { usableQuestionsWhere } from "@/lib/questionBank";
import { checkReadiness, estimateLoopCost, parseRounds, publishedRounds, totalMinutes } from "@/lib/loopTemplates";
import type { HiringPaths } from "@/lib/hiring/paths";
import { LoopBuilder } from "../LoopBuilder";
import { NewLoopForm } from "../NewLoopForm";
import { CopyTemplateButton } from "../CopyTemplateButton";

const PILL: Record<LoopStatus, string> = {
  PUBLISHED: "border-easy/40 bg-easy/10 text-easy",
  DRAFT: "border-medium/40 bg-medium/10 text-medium",
  ARCHIVED: "border-border bg-bg-inset text-text-dim",
};

interface Scope {
  organizationId: string | null;
  paths: HiringPaths;
}

/** Published inturview loops a workspace can start from. */
async function templates() {
  const rows = await prisma.loopTemplate.findMany({
    where: { organizationId: null, status: LoopStatus.PUBLISHED },
    orderBy: { name: "asc" },
    select: { id: true, name: true, roleTarget: true, level: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } },
  });
  return rows.map((t) => {
    const rounds = publishedRounds(t.versions[0]?.snapshot);
    return { id: t.id, name: t.name, meta: [t.roleTarget, t.level].filter(Boolean).join(" · "), rounds: rounds.length, minutes: totalMinutes(rounds) };
  });
}

function TemplateList({ items }: { items: Awaited<ReturnType<typeof templates>> }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="templates-heading">
      <div>
        <h2 id="templates-heading" className="text-sm font-semibold">Start from an inturview template</h2>
        <p className="text-xs text-text-dim">You get your own copy to edit. Later changes to the template don&apos;t affect it.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((t) => (
          <li key={t.id} className="panel p-4 flex flex-col gap-3">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-text-dim">
                {[t.meta, `${t.rounds} round${t.rounds === 1 ? "" : "s"}`, `${t.minutes} min`].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div><CopyTemplateButton templateId={t.id} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function LoopsView({ organizationId, paths }: Scope) {
  const [loops, starters] = await Promise.all([
    prisma.loopTemplate.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: { id: true, name: true, roleTarget: true, level: true, rounds: true, status: true, currentVersion: true },
    }),
    paths.workspace ? templates() : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{paths.workspace ? "Interview loops" : "Template loops"}</h1>
          <p className="text-sm text-text-muted mt-1">
            {paths.workspace
              ? "The rounds a candidate goes through after you invite them."
              : "Published templates show up in every workspace as a starting point."}
          </p>
        </div>
        <Link href={`${paths.loops}/new`} className="btn btn-primary text-sm"><Plus className="h-4 w-4" /> New loop</Link>
      </header>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Loop", "Rounds", "Time", "Est. cost", "Status", "Version"].map((h, i) => (
                  <th key={h} className={`font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 ${i > 0 && i !== 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loops.map((l) => {
                const rounds = parseRounds(l.rounds);
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-bg-inset/50">
                    <td className="px-4 py-3">
                      <Link href={`${paths.loops}/${l.id}`} className="font-medium hover:underline underline-offset-2">{l.name}</Link>
                      {(l.roleTarget || l.level) && <span className="ml-2 text-xs text-text-dim">{[l.roleTarget, l.level].filter(Boolean).join(" · ")}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{rounds.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{totalMinutes(rounds)} min</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">${estimateLoopCost(rounds).totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-3"><span className={`badge ${PILL[l.status]}`}>{l.status.toLowerCase()}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{l.currentVersion || "—"}</td>
                  </tr>
                );
              })}
              {loops.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-text-dim py-8">
                    {paths.workspace ? "No loops yet. Start from a template below, or build one from scratch." : "No templates yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TemplateList items={starters} />
    </div>
  );
}

export async function LoopNewView({ paths }: { paths: HiringPaths }) {
  const starters = paths.workspace ? await templates() : [];
  return (
    <div className="space-y-6">
      <Link href={paths.loops} className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Loops
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New loop</h1>
        <p className="text-sm text-text-muted mt-1">Name it now; you&apos;ll add rounds on the next screen.</p>
      </header>
      <NewLoopForm />
      <TemplateList items={starters} />
    </div>
  );
}

export async function LoopDetailView({ organizationId, paths, id, canInvite }: Scope & { id: string; canInvite: boolean }) {
  const loop = await prisma.loopTemplate.findFirst({
    where: { id, organizationId },
    include: { versions: { orderBy: { version: "desc" }, take: 10, select: { id: true, version: true, publishedAt: true } } },
  });
  if (!loop) notFound();

  const rounds = parseRounds(loop.rounds);
  const fixedIds = rounds.flatMap((r) => (r.questions.mode === "fixed" ? r.questions.questionIds : []));
  const [titles, readiness] = await Promise.all([
    fixedIds.length
      ? prisma.question.findMany({ where: { AND: [{ id: { in: fixedIds } }, usableQuestionsWhere(organizationId)] }, select: { id: true, title: true } })
      : [],
    checkReadiness(rounds, organizationId),
  ]);

  return (
    <div className="space-y-6">
      <Link href={paths.loops} className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Loops
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{loop.name}</h1>
        {loop.status === "PUBLISHED" && canInvite && (
          <Link href={`${paths.invites}/new?loop=${loop.id}`} className="btn btn-primary text-sm">Invite candidates</Link>
        )}
        {loop.status === "PUBLISHED" && !paths.workspace && (
          <p className="text-xs text-text-dim">Workspaces can start from this template on their Loops page.</p>
        )}
        {loop.versions.length > 0 && (
          <p className="text-xs text-text-dim w-full">
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
        revision={loop.revision}
      />
    </div>
  );
}
