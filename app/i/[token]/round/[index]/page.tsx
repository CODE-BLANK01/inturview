import { redirect } from "next/navigation";
import { ApplicantShell } from "@/components/applicant/ApplicantShell";
import { prisma } from "@/lib/db";
import { findInviteByToken } from "@/lib/invites";
import { publishedRounds } from "@/lib/loopTemplates";
import { CATEGORY_LABELS } from "@/lib/questionBank";
import { LoopRoundChat } from "@/components/LoopRoundChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interview round — inturview", robots: { index: false, follow: false } };

export default async function LoopRoundPage({ params }: { params: { token: string; index: string } }) {
  const found = await findInviteByToken(params.token);
  if (!found.ok || !found.invite.consentedAt) redirect(`/i/${params.token}`);
  const index = Number(params.index);
  const version = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: found.invite.campaign.loopTemplateId, version: found.invite.campaign.loopVersion } },
    select: { snapshot: true },
  });
  const rounds = publishedRounds(version?.snapshot);
  const round = rounds[index];
  if (!Number.isInteger(index) || !round) redirect(`/i/${params.token}`);
  return (
    <ApplicantShell company={found.invite.campaign.organization}>
      <LoopRoundChat
        token={params.token}
        roundIndex={index}
        roundCount={rounds.length}
        title={round.title || CATEGORY_LABELS[round.category]}
        minutes={round.durationMinutes}
        isCoding={round.category === "CODING" || round.category === "SYSTEM_DESIGN"}
      />
    </ApplicantShell>
  );
}
