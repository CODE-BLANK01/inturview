// Hiring roles and the candidates pipeline (workspaces only).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { publishedRounds, totalMinutes } from "@/lib/loopTemplates";
import { STAGE_LABEL, STAGE_PILL, STAGES, type Stage } from "@/lib/candidateStage";
import { listCandidates, type CandidateRow } from "@/lib/hiring/candidates";
import type { HiringPaths } from "@/lib/hiring/paths";
import { InviteRowActions } from "../CampaignActions";
import { NewCampaignForm } from "../NewCampaignForm";
import { EditableRole, RoleForm, RoleStatusButtons } from "../RoleForm";

interface Scope {
  organizationId: string;
  paths: HiringPaths;
}

/** The role page shows the latest few; the Candidates page pages through all. */
const ROLE_PAGE = 25;
const ROLE_STATUS: Record<string, string> = { OPEN: "Open", PAUSED: "Paused", CLOSED: "Closed" };
const ago = (d: Date) => {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

async function publishedLoops(organizationId: string) {
  const loops = await prisma.loopTemplate.findMany({
    where: { organizationId, status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, currentVersion: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } },
  });
  return loops.map((l) => {
    const rounds = publishedRounds(l.versions[0]?.snapshot);
    return { id: l.id, name: l.name, version: l.currentVersion, rounds: rounds.length, minutes: totalMinutes(rounds) };
  });
}

function countByStage(rows: CandidateRow[]) {
  const counts: Partial<Record<Stage, number>> = {};
  for (const r of rows) counts[r.stage] = (counts[r.stage] ?? 0) + 1;
  return counts;
}

export function CandidatesTable({ rows, paths, showRole, canSend }: { rows: CandidateRow[]; paths: HiringPaths; showRole: boolean; canSend: boolean }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border text-text-dim">
              {["Candidate", ...(showRole ? ["Role"] : []), "Stage", "Score", "Last activity", ...(canSend ? [""] : [])].map((h) => (
                <th key={h} className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3">
                  <Link href={`${paths.candidates}/${c.id}`} className="font-medium hover:underline underline-offset-2">{c.redacted ? "Deleted applicant" : c.name ?? c.email}</Link>
                  {c.name && !c.redacted && <div className="text-xs text-text-dim break-all">{c.email}</div>}
                  {c.attention && <div className="text-xs text-hard mt-0.5">{c.attention}</div>}
                </td>
                {showRole && (
                  <td className="px-4 py-3 text-text-muted">
                    {c.role ? <Link href={`${paths.roles}/${c.role.id}`} className="hover:underline underline-offset-2">{c.role.title}</Link> : <span className="text-text-dim">No role</span>}
                  </td>
                )}
                <td className="px-4 py-3"><span className={`badge whitespace-nowrap ${STAGE_PILL[c.stage]}`}>{STAGE_LABEL[c.stage]}</span></td>
                <td className="px-4 py-3 tabular-nums">
                  {c.score ?? <span className="text-text-dim">—</span>}
                  {c.coverage && c.score !== null && <span className="block text-xs text-text-dim">{c.coverage.assessed}/{c.coverage.total} assessed</span>}
                </td>
                <td className="px-4 py-3 text-text-dim whitespace-nowrap">{ago(c.lastActivity)}</td>
                {canSend && <td className="px-4 py-3"><InviteRowActions inviteId={c.id} status={c.inviteStatus} /></td>}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-text-dim py-8">No candidates here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function RolesView({ organizationId, paths, canEdit }: Scope & { canEdit: boolean }) {
  const [roles, loops, candidates] = await Promise.all([
    prisma.hiringRole.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, seniority: true, location: true, status: true, loopTemplate: { select: { name: true } } },
    }),
    publishedLoops(organizationId),
    listCandidates(organizationId),
  ]);
  const byRole = new Map<string, CandidateRow[]>();
  for (const c of candidates) if (c.role) byRole.set(c.role.id, [...(byRole.get(c.role.id) ?? []), c]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
        <p className="text-sm text-text-muted mt-1">Each role has an interview loop and its own candidates.</p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {roles.map((r) => {
          const counts = countByStage(byRole.get(r.id) ?? []);
          const total = byRole.get(r.id)?.length ?? 0;
          return (
            <li key={r.id}>
              <Link href={`${paths.roles}/${r.id}`} className="panel p-4 block hover:border-accent/40 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-text-dim">
                      {[r.seniority, r.location].filter(Boolean).join(" · ") || "—"} · {r.loopTemplate?.name ?? "No loop yet"}
                    </div>
                  </div>
                  <span className={`badge ${r.status === "OPEN" ? "border-easy/40 bg-easy/10 text-easy" : "border-border bg-bg-inset text-text-dim"}`}>{ROLE_STATUS[r.status]}</span>
                </div>
                <div className="text-xs text-text-muted flex flex-wrap gap-x-3">
                  <span>{total} candidate{total === 1 ? "" : "s"}</span>
                  {counts.ready ? <span className="text-easy">{counts.ready} ready for review</span> : null}
                  {counts.needs_attention ? <span className="text-hard">{counts.needs_attention} need attention</span> : null}
                  {counts.in_progress ? <span>{counts.in_progress} in progress</span> : null}
                </div>
              </Link>
            </li>
          );
        })}
        {roles.length === 0 && <li className="text-sm text-text-dim">No roles yet. Create your first one below.</li>}
      </ul>
      {canEdit && <RoleForm loops={loops.map((l) => ({ id: l.id, name: l.name }))} />}
    </div>
  );
}

export async function RoleDetailView({ organizationId, paths, id, canEdit, canSend }: Scope & { id: string; canEdit: boolean; canSend: boolean }) {
  const role = await prisma.hiringRole.findFirst({ where: { id, organizationId }, include: { organization: { select: { name: true, contactEmail: true } } } });
  if (!role) notFound();
  const [loops, candidates] = await Promise.all([publishedLoops(organizationId), listCandidates(organizationId, { roleId: id })]);
  const counts = countByStage(candidates);
  const loop = loops.find((l) => l.id === role.loopTemplateId);

  return (
    <div className="space-y-6">
      <Link href={paths.roles} className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Roles
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {canEdit ? (
            <EditableRole
              roleId={role.id}
              loops={loops.map((l) => ({ id: l.id, name: l.name }))}
              initial={{ title: role.title, seniority: role.seniority ?? "", location: role.location ?? "", context: role.context ?? "", loopTemplateId: role.loopTemplateId ?? "" }}
            >
              <RoleHeading role={role} loopName={loop?.name ?? null} />
            </EditableRole>
          ) : (
            <RoleHeading role={role} loopName={loop?.name ?? null} />
          )}
        </div>
        {canEdit && <RoleStatusButtons roleId={role.id} status={role.status} />}
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Pipeline">
        {(["ready", "needs_attention", "in_progress", "invited"] as const).map((s) => (
          <Link key={s} href={`${paths.candidates}?role=${role.id}&stage=${s}`} className="panel p-3 hover:border-accent/40">
            <div className="text-2xl font-semibold tabular-nums">{s === "invited" ? (counts.invited ?? 0) + (counts.opened ?? 0) + (counts.queued ?? 0) : counts[s] ?? 0}</div>
            <div className="text-xs text-text-dim">{s === "invited" ? "Invited, not started" : STAGE_LABEL[s]}</div>
          </Link>
        ))}
      </section>

      {canSend && role.status === "OPEN" && (
        <section className="space-y-3" aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="text-sm font-semibold">Invite candidates</h2>
          {loops.length === 0 ? (
            <p className="panel p-4 text-sm text-text-muted">
              Publish a loop first. <Link href={paths.loops} className="underline underline-offset-2">Go to loops</Link>
            </p>
          ) : (
            <NewCampaignForm loops={loops} defaultLoopId={role.loopTemplateId ?? undefined} roleId={role.id} company={role.organization} />
          )}
        </section>
      )}
      {role.status !== "OPEN" && <p className="panel p-3 text-sm text-text-muted">This role is {ROLE_STATUS[role.status]!.toLowerCase()}. Reopen it to invite more candidates; existing invites keep working.</p>}

      <section className="space-y-3" aria-labelledby="candidates-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="candidates-heading" className="text-sm font-semibold">Candidates</h2>
          {candidates.length > ROLE_PAGE && (
            <Link href={`${paths.candidates}?role=${role.id}`} className="text-sm underline underline-offset-2">See all {candidates.length}</Link>
          )}
        </div>
        <CandidatesTable rows={candidates.slice(0, ROLE_PAGE)} paths={paths} showRole={false} canSend={canSend} />
      </section>
    </div>
  );
}

function RoleHeading({ role, loopName }: { role: { title: string; seniority: string | null; location: string | null; context: string | null }; loopName: string | null }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{role.title}</h1>
      <p className="text-sm text-text-muted flex flex-wrap items-center gap-x-3">
        {role.seniority && <span>{role.seniority}</span>}
        {role.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{role.location}</span>}
        <span>Loop: {loopName ?? "not chosen"}</span>
      </p>
      {role.context && <p className="text-sm text-text-muted whitespace-pre-line max-w-3xl">{role.context}</p>}
    </div>
  );
}

const PAGE_SIZE = 50;

export async function CandidatesView({ organizationId, paths, canSend, stage, roleId, page = 1 }: Scope & { canSend: boolean; stage?: string; roleId?: string; page?: number }) {
  const [all, roles] = await Promise.all([
    listCandidates(organizationId, { roleId }),
    prisma.hiringRole.findMany({ where: { organizationId }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  const counts = countByStage(all);
  const active = (STAGES as readonly string[]).includes(stage ?? "") ? (stage as Stage) : null;
  // "Invited" groups everyone who hasn't started yet.
  const notStarted: Stage[] = ["invited", "opened", "queued"];
  // "All active": still in play, so not cancelled and not yet decided.
  const settled: Stage[] = ["cancelled", "advanced", "declined"];
  const rows = active ? all.filter((c) => (active === "invited" ? notStarted.includes(c.stage) : c.stage === active)) : all.filter((c) => !settled.includes(c.stage));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const href = (s: string | null, p = 1) => {
    const q = new URLSearchParams();
    if (roleId) q.set("role", roleId);
    if (s) q.set("stage", s);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${paths.candidates}?${qs}` : paths.candidates;
  };
  const tabs: { key: string | null; label: string; n: number }[] = [
    { key: null, label: "All active", n: all.filter((c) => !settled.includes(c.stage)).length },
    { key: "ready", label: STAGE_LABEL.ready, n: counts.ready ?? 0 },
    { key: "needs_attention", label: STAGE_LABEL.needs_attention, n: counts.needs_attention ?? 0 },
    { key: "scoring", label: STAGE_LABEL.scoring, n: counts.scoring ?? 0 },
    { key: "in_progress", label: STAGE_LABEL.in_progress, n: counts.in_progress ?? 0 },
    { key: "invited", label: "Not started", n: notStarted.reduce((a, s) => a + (counts[s] ?? 0), 0) },
    { key: "advanced", label: STAGE_LABEL.advanced, n: counts.advanced ?? 0 },
    { key: "declined", label: STAGE_LABEL.declined, n: counts.declined ?? 0 },
    { key: "cancelled", label: STAGE_LABEL.cancelled, n: counts.cancelled ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-text-muted mt-1">Everyone you&apos;ve invited, across roles.</p>
        </div>
        <form action={paths.candidates} className="flex gap-2 items-end">
          {active && <input type="hidden" name="stage" value={active} />}
          <select name="role" defaultValue={roleId ?? ""} className="input text-sm" aria-label="Role">
            <option value="">All roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <button className="btn text-sm" type="submit">Filter</button>
        </form>
      </header>
      <nav className="flex flex-wrap gap-1 border-b border-border text-sm" aria-label="Stages">
        {tabs.map((t) => {
          const on = (t.key ?? null) === (active ?? null);
          return (
            <Link key={t.label} href={href(t.key)} aria-current={on ? "page" : undefined} className={`px-3 py-2 -mb-px border-b-2 ${on ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"}`}>
              {t.label} <span className="tabular-nums text-text-dim">{t.n}</span>
            </Link>
          );
        })}
      </nav>
      <CandidatesTable rows={shown} paths={paths} showRole={!roleId} canSend={canSend} />
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pages">
          <span className="text-text-dim">
            {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <span className="flex gap-2">
            {current > 1 && <Link className="btn text-sm" href={href(active, current - 1)}>Previous</Link>}
            {current < pages && <Link className="btn text-sm" href={href(active, current + 1)}>Next</Link>}
          </span>
        </nav>
      )}
    </div>
  );
}
