import { AuthShell } from "@/components/AuthShell";
import { prisma } from "@/lib/db";
import { findInviteByToken, markOpened } from "@/lib/invites";
import { parseRounds, totalMinutes } from "@/lib/loopTemplates";
import { CATEGORY_LABELS } from "@/lib/questionBank";
import { InviteConsent } from "@/components/InviteConsent";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your interview — inturview", robots: { index: false, follow: false } };

const MESSAGES = {
  unknown: ["This link doesn't work", "Check that you opened the full link from your email. If it still doesn't work, reply to the invitation email and we'll send a new one."],
  revoked: ["This invitation was cancelled", "If you think that's a mistake, reply to the invitation email."],
  expired: ["This link has expired", "Reply to the invitation email and ask for a new link."],
} as const;

export default async function InvitePage({ params }: { params: { token: string } }) {
  const found = await findInviteByToken(params.token);
  if (!found.ok) {
    const [title, body] = MESSAGES[found.reason];
    return (
      <AuthShell>
        <div className="w-full max-w-md mx-auto panel p-7">
          <h1 className="t-section-headline text-2xl mb-2">{title}</h1>
          <p className="t-body-light text-sm text-text-muted">{body}</p>
        </div>
      </AuthShell>
    );
  }
  const { invite } = found;
  await markOpened(invite.id);

  const version = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: invite.campaign.loopTemplateId, version: invite.campaign.loopVersion } },
    select: { snapshot: true },
  });
  const config = (version?.snapshot as { config?: { name: string; description: string | null; rounds: unknown } } | undefined)?.config;
  const rounds = parseRounds(config?.rounds ?? []);
  const first = invite.name?.split(/\s+/)[0];
  const until = invite.expiresAt?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <AuthShell>
      <div className="w-full max-w-xl mx-auto space-y-5">
        <div className="panel p-7 space-y-4">
          <p className="t-eyebrow">Interview invitation</p>
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
            {until && <> The link works until {until}.</>}
          </p>
        </div>
        <InviteConsent token={params.token} consented={!!invite.consentedAt} />
      </div>
    </AuthShell>
  );
}
