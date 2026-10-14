import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/questionBank";
import { publishedRounds } from "@/lib/loopTemplates";
import type { FrozenQuestion, Scorecard } from "@/lib/loopRunEngine";
import { RescoreButton } from "@/components/admin/RescoreButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidate — inturview admin" };

const band = (n: number) => (n >= 75 ? "text-easy" : n >= 50 ? "text-medium" : "text-hard");

export default async function CandidatePage({ params }: { params: { id: string; inviteId: string } }) {
  const invite = await prisma.invite.findFirst({
    where: { id: params.inviteId, campaignId: params.id },
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
      <Link href={`/admin/campaigns/${invite.campaign.id}`} className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> {invite.campaign.name}
      </Link>
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
                {rr?.status === "SCORING" && <><span className="text-sm text-hard">Scoring didn&apos;t finish</span><RescoreButton roundRunId={rr.id} /></>}
                {rr?.status === "COMPLETED" && rr.score != null && (
                  <>
                    <span className={`text-2xl font-semibold tabular-nums ${band(rr.score)}`}>{rr.score}</span>
                    <RescoreButton roundRunId={rr.id} />
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
