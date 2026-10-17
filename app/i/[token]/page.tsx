import { redirect } from "next/navigation";
import { ApplicantShell } from "@/components/applicant/ApplicantShell";
import { contactFor, deadlineText } from "@/lib/applicant";
import { prisma } from "@/lib/db";
import { campaignSnapshot } from "@/lib/loopSnapshot";
import { findInviteByToken, markOpened } from "@/lib/invites";
import { publishedRounds, totalMinutes } from "@/lib/loopTemplates";
import { CATEGORY_LABELS } from "@/lib/questionBank";
import Link from "next/link";
import { InviteConsent } from "@/components/InviteConsent";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your interview — inturview", robots: { index: false, follow: false } };

const MESSAGES = {
  unknown: ["This link doesn't work", "Check that you opened the full link from your email. If it still doesn't work, reply to the invitation email and the hiring team will send a new one."],
  revoked: ["This invitation was cancelled", "If you think that's a mistake, reply to the invitation email."],
  expired: ["This link has expired", "Reply to the invitation email and ask the hiring team for a new link."],
} as const;

export default async function InvitePage({ params }: { params: { token: string } }) {
  const found = await findInviteByToken(params.token);
  if (!found.ok) {
    const [title, body] = MESSAGES[found.reason];
    return (
      <ApplicantShell company={null}>
        <div className="w-full max-w-md mx-auto panel p-7">
          <h1 className="t-section-headline text-2xl mb-2">{title}</h1>
          <p className="t-body-light text-sm text-text-muted">{body}</p>
        </div>
      </ApplicantShell>
    );
  }
  const { invite } = found;
  const company = invite.campaign.organization;
  if (invite.status === "COMPLETED") redirect(`/i/${params.token}/done`);
  await markOpened(invite.id);

  const snapshot = await campaignSnapshot(invite.campaign);
  const config = (snapshot as { config?: { name: string; description: string | null; rounds: unknown } } | undefined)?.config;
  const rounds = publishedRounds(snapshot);
  const run = await prisma.loopRun.findUnique({ where: { inviteId: invite.id }, select: { rounds: { select: { roundIndex: true, status: true } } } });
  const doneRounds = new Set((run?.rounds ?? []).filter((r) => r.status !== "IN_PROGRESS").map((r) => r.roundIndex));
  const inProgressRound = run?.rounds.find((r) => r.status === "IN_PROGRESS")?.roundIndex ?? null;
  // Every round is in: show the confirmation, even while scoring is still running.
  if (rounds.length > 0 && doneRounds.size >= rounds.length) redirect(`/i/${params.token}/done`);
  const first = invite.name?.split(/\s+/)[0];
  const until = invite.expiresAt ? deadlineText(invite.expiresAt, company?.timezone ?? "UTC") : null;
  const contact = contactFor(company);

  return (
    <ApplicantShell company={company} preview={invite.campaign.preview}>
      <div className="w-full max-w-xl mx-auto space-y-5">
        <div className="panel p-7 space-y-4">
          <p className="t-eyebrow">{company ? `Interview with ${company.name}` : "Interview invitation"}</p>
          <h1 className="t-section-headline text-3xl">{first ? `${first}, here's your interview` : "Here's your interview"}</h1>
          <p className="text-lg font-medium">{config?.name ?? "Interview"}</p>
          {config?.description && <p className="text-sm text-text-muted">{config.description}</p>}
          {invite.campaign.message && (
            <blockquote className="border-l-2 border-border pl-3 text-sm text-text-muted whitespace-pre-line">{invite.campaign.message}</blockquote>
          )}
          <ol className="divide-y divide-border border-y border-border">
            {rounds.map((r, i) => (
              <li key={r.id} className="py-3 flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium"><span className="text-text-dim tabular-nums">{i + 1}.</span> {r.title || CATEGORY_LABELS[r.category]}</p>
                  {r.candidateBrief && <p className="text-sm text-text-muted mt-0.5">{r.candidateBrief}</p>}
                </div>
                <span className="text-sm text-text-dim tabular-nums whitespace-nowrap">{r.durationMinutes} min</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-text-muted">
            About {totalMinutes(rounds)} minutes in total. You can take a break between rounds.
            {until && <> Finish by {until}.</>}
          </p>
          <p className="text-sm text-text-muted">
            Questions, or need an adjustment?{" "}
            {contact.href ? <a className="underline underline-offset-2" href={contact.href}>{contact.label}</a> : <>Reply to {contact.label}.</>}
          </p>
        </div>
        {invite.consentedAt ? (
          <RoundsPanel token={params.token} roundCount={rounds.length} done={doneRounds} inProgress={inProgressRound} />
        ) : (
          <InviteConsent token={params.token} consented={false} company={company?.name ?? null} contact={contact} />
        )}
      </div>
    </ApplicantShell>
  );
}

function RoundsPanel({ token, roundCount, done, inProgress }: { token: string; roundCount: number; done: Set<number>; inProgress: number | null }) {
  const next = inProgress ?? [...Array(roundCount).keys()].find((i) => !done.has(i)) ?? 0;
  return (
    <div className="panel p-7 space-y-4">
      <h2 className="text-lg font-semibold">{done.size === 0 && inProgress === null ? "Ready when you are" : `Round ${next + 1} of ${roundCount}`}</h2>
      <p className="text-sm text-text-muted">
        {done.size > 0 ? `${done.size} of ${roundCount} rounds done. ` : ""}
        Find a quiet spot. Answer the way you would in a real interview: specific examples beat general statements.
      </p>
      <Link href={`/i/${token}/round/${next}`} className="btn btn-primary w-full justify-center">
        {inProgress !== null ? `Continue round ${next + 1}` : `Start round ${next + 1}`}
      </Link>
      <p className="text-xs text-text-dim">Keep this link. You can come back to it any time before it expires.</p>
    </div>
  );
}
