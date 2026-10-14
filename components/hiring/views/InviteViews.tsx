// Invite screens: workspaces send and follow up; Admin keeps the pre-workspace
// test campaigns readable (organizationId null, no actions).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import type { InviteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { funnelFrom } from "@/lib/campaignStats";
import { CATEGORY_LABELS } from "@/lib/questionBank";
import { publishedRounds, totalMinutes } from "@/lib/loopTemplates";
import type { FrozenQuestion, Scorecard } from "@/lib/loopRunEngine";
import type { HiringPaths } from "@/lib/hiring/paths";
import { AddCandidates, CampaignSendButtons, InviteRowActions } from "../CampaignActions";
import { NewCampaignForm } from "../NewCampaignForm";
import { RescoreButton } from "../RescoreButton";

interface Scope {
  organizationId: string | null;
  paths: HiringPaths;
}

const PILL: Record<InviteStatus, string> = {
  PENDING: "border-border bg-bg-inset text-text-dim",
  SENT: "border-border bg-bg-surface text-text-muted",
  OPENED: "border-medium/40 bg-medium/10 text-medium",
  STARTED: "border-medium/40 bg-medium/10 text-medium",
  COMPLETED: "border-easy/40 bg-easy/10 text-easy",
  FAILED: "border-hard/40 bg-hard/10 text-hard",
  REVOKED: "border-border bg-bg-inset text-text-dim",
};
const LABEL: Record<InviteStatus, string> = { PENDING: "queued", SENT: "sent", OPENED: "opened", STARTED: "started", COMPLETED: "finished", FAILED: "failed", REVOKED: "cancelled" };
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
const band = (n: number) => (n >= 75 ? "text-easy" : n >= 50 ? "text-medium" : "text-hard");

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

function LegacyNote() {
  return (
    <p className="panel p-3 text-sm text-text-muted">
      Test invites from before workspaces. They belong to no company, so they&apos;re read-only here and are never assigned to one
      automatically. New invites are sent from a workspace.
    </p>
  );
}

export async function InvitesView({ organizationId, paths, canSend }: Scope & { canSend: boolean }) {
  const [campaigns, counts] = await Promise.all([
    prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, loopVersion: true, loopTemplate: { select: { name: true } } },
    }),
    prisma.invite.groupBy({ by: ["campaignId", "status"], where: { campaign: { organizationId } }, _count: true }),
  ]);
  const byCampaign = new Map<string, Partial<Record<InviteStatus, number>>>();
  for (const c of counts) byCampaign.set(c.campaignId, { ...byCampaign.get(c.campaignId), [c.status]: c._count });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
          <p className="text-sm text-text-muted mt-1">Each batch sends one published loop to a group of candidates.</p>
        </div>
        {canSend && <Link href={`${paths.invites}/new`} className="btn btn-primary text-sm"><Plus className="h-4 w-4" /> Invite candidates</Link>}
      </header>
      {!paths.workspace && <LegacyNote />}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Batch", "Invited", "Opened", "Started", "Finished", "Sent"].map((h, i) => (
                  <th key={h} className={`font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const f = funnelFrom(byCampaign.get(c.id) ?? {});
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg-inset/50">
                    <td className="px-4 py-3">
                      <Link href={`${paths.invites}/${c.id}`} className="font-medium hover:underline underline-offset-2">{c.name}</Link>
                      <span className="ml-2 text-xs text-text-dim">{c.loopTemplate.name} · v{c.loopVersion}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.invited}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{f.opened}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{f.started}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{f.completed}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-dim">{c.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && (
                <tr><td colSpan={6} className="text-center text-text-dim py-8">No invites sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export async function InviteNewView({ organizationId, paths, defaultLoopId }: Scope & { defaultLoopId?: string }) {
  const loops = await prisma.loopTemplate.findMany({
    where: { organizationId, status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, currentVersion: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } },
  });
  const options = loops.map((l) => {
    const rounds = publishedRounds(l.versions[0]?.snapshot);
    return { id: l.id, name: l.name, version: l.currentVersion, rounds: rounds.length, minutes: totalMinutes(rounds) };
  });
  return (
    <div className="space-y-6">
      <BackLink href={paths.invites} label="Invites" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Invite candidates</h1>
        <p className="text-sm text-text-muted mt-1">Everyone gets a personal link by email. Candidates don&apos;t need an account.</p>
      </header>
      {options.length === 0 ? (
        <p className="panel p-5 text-sm text-text-muted">
          Publish a loop first. <Link href={paths.loops} className="underline underline-offset-2">Go to loops</Link>
        </p>
      ) : (
        <NewCampaignForm loops={options} defaultLoopId={defaultLoopId} />
      )}
    </div>
  );
}

export async function CampaignView({ organizationId, paths, id, canSend }: Scope & { id: string; canSend: boolean }) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId },
    include: { loopTemplate: { select: { id: true, name: true } }, invites: { orderBy: { createdAt: "asc" }, include: { run: { select: { overallScore: true } } } } },
  });
  if (!campaign) notFound();
  const counts: Partial<Record<InviteStatus, number>> = {};
  for (const i of campaign.invites) counts[i.status] = (counts[i.status] ?? 0) + 1;
  const f = funnelFrom(counts);
  const pct = (n: number) => (f.sent ? `${Math.round((n / f.sent) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <BackLink href={paths.invites} label="Invites" />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="text-sm text-text-muted">
          {paths.workspace ? (
            <Link className="underline underline-offset-2" href={`${paths.loops}/${campaign.loopTemplate.id}`}>{campaign.loopTemplate.name}</Link>
          ) : (
            campaign.loopTemplate.name
          )}{" "}
          · version {campaign.loopVersion}
          {campaign.deadline && <> · deadline {day(campaign.deadline)}</>}
        </p>
      </header>
      {!paths.workspace && <LegacyNote />}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([["Invited", f.invited, null], ["Sent", f.sent, null], ["Opened", f.opened, pct(f.opened)], ["Started", f.started, pct(f.started)], ["Finished", f.completed, pct(f.completed)]] as const).map(([label, n, rate]) => (
          <div key={label} className="panel p-3">
            <div className="text-2xl font-semibold tabular-nums">{n}</div>
            <div className="text-xs text-text-dim">
              {label}
              {rate && ` · ${rate} of sent`}
              {label === "Invited" && f.revoked > 0 && ` · ${f.revoked} cancelled`}
              {label === "Invited" && f.failed > 0 && ` · ${f.failed} failed`}
            </div>
          </div>
        ))}
      </div>

      {canSend && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CampaignSendButtons campaignId={campaign.id} pending={f.pending} failed={f.failed} />
          <AddCandidates campaignId={campaign.id} />
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Candidate", "Status", "Score", "Sent", "Finished", ...(canSend ? [""] : [])].map((h) => (
                  <th key={h} className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaign.invites.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`${paths.invites}/${campaign.id}/candidates/${i.id}`} className="font-medium hover:underline underline-offset-2">{i.name ?? i.email}</Link>
                    {i.name && <div className="text-xs text-text-dim">{i.email}</div>}
                    {i.status === "FAILED" && i.lastError && <div className="text-xs text-hard mt-0.5">{i.lastError}</div>}
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${PILL[i.status]}`}>{LABEL[i.status]}</span>{i.sendCount > 1 && <span className="ml-1 text-xs text-text-dim">×{i.sendCount}</span>}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{i.run?.overallScore ?? <span className="font-normal text-text-dim">—</span>}</td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">{day(i.sentAt)}</td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">{day(i.completedAt)}</td>
                  {canSend && <td className="px-4 py-3"><InviteRowActions inviteId={i.id} status={i.status} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export async function CandidateView({ organizationId, paths, campaignId, inviteId, canRescore }: Scope & { campaignId: string; inviteId: string; canRescore: boolean }) {
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, campaignId, campaign: { organizationId } },
    include: {
      campaign: { select: { id: true, name: true, loopTemplateId: true, loopVersion: true } },
      run: { include: { rounds: { orderBy: { roundIndex: "asc" }, include: { messages: { orderBy: { createdAt: "asc" } } } } } },
    },
  });
  if (!invite) notFound();
  const version = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: invite.campaign.loopTemplateId, version: invite.campaign.loopVersion } },
    select: { snapshot: true },
  });
  const plan = publishedRounds(version?.snapshot);

  return (
    <div className="space-y-6">
      <BackLink href={`${paths.invites}/${invite.campaign.id}`} label={invite.campaign.name} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{invite.name ?? invite.email}</h1>
          <p className="text-sm text-text-muted">{invite.email} · {invite.status.toLowerCase()}{invite.consentedAt && ` · consented ${invite.consentedAt.toISOString().slice(0, 10)}`}</p>
        </div>
        {invite.run?.overallScore != null && (
          <div className="text-right">
            <div className={`text-4xl font-semibold tabular-nums ${band(invite.run.overallScore)}`}>{invite.run.overallScore}</div>
            <div className="text-xs text-text-dim">overall, out of 100</div>
          </div>
        )}
      </header>
      <p className="text-xs text-text-dim">AI scores support your judgment; they don&apos;t replace it. Read the transcript before deciding.</p>

      {plan.map((round, i) => {
        const rr = invite.run?.rounds.find((r) => r.roundIndex === i);
        const sc = rr?.scorecard as Scorecard | null | undefined;
        const qs = (rr?.questions ?? []) as unknown as FrozenQuestion[];
        return (
          <section key={round.id} className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-semibold">
                <span className="text-text-dim">Round {i + 1} ·</span> {round.title || CATEGORY_LABELS[round.category]}
              </h2>
              <div className="flex items-center gap-3">
                {!rr && <span className="text-sm text-text-dim">Not started</span>}
                {rr?.status === "IN_PROGRESS" && <span className="text-sm text-medium">In progress</span>}
                {rr?.status === "SCORING" && (
                  <>
                    <span className="text-sm text-hard">Scoring didn&apos;t finish</span>
                    {canRescore && <RescoreButton roundRunId={rr.id} />}
                  </>
                )}
                {rr?.status === "COMPLETED" && rr.score != null && (
                  <>
                    <span className={`text-2xl font-semibold tabular-nums ${band(rr.score)}`}>{rr.score}</span>
                    {canRescore && <RescoreButton roundRunId={rr.id} />}
                  </>
                )}
              </div>
            </div>

            {sc && (
              <div className="space-y-3">
                <p className="text-sm">{sc.summary}</p>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  {sc.strengths.length > 0 && <div><p className="text-xs uppercase tracking-[0.08em] text-text-dim mb-1">Strengths</p><ul className="list-disc pl-4 space-y-0.5">{sc.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
                  {sc.improvements.length > 0 && <div><p className="text-xs uppercase tracking-[0.08em] text-text-dim mb-1">Gaps</p><ul className="list-disc pl-4 space-y-0.5">{sc.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>}
                </div>
                <table className="min-w-full text-sm">
                  <tbody>
                    {sc.questions.map((q) => (
                      <tr key={q.questionId} className="border-t border-border align-top">
                        <td className="py-2 pr-3 tabular-nums font-semibold whitespace-nowrap">{q.score}/5</td>
                        <td className="py-2">
                          <p className="font-medium">{qs.find((x) => x.questionId === q.questionId)?.title ?? "Question"}</p>
                          <p className="text-text-muted">{q.evidence}</p>
                          {q.missing && <p className="text-text-dim">Missing: {q.missing}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rr && rr.messages.length > 0 && (
              <details>
                <summary className="text-sm font-medium cursor-pointer">Transcript ({rr.messages.length} messages)</summary>
                <div className="mt-3 space-y-2">
                  {rr.messages.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="text-xs uppercase tracking-[0.06em] text-text-dim">{m.role === "candidate" ? "Candidate" : "Interviewer"}</span>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
