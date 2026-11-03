import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ApplicantShell } from "@/components/applicant/ApplicantShell";
import { companyTime, contactFor, retentionText } from "@/lib/applicant";
import { prisma } from "@/lib/db";
import { campaignSnapshot } from "@/lib/loopSnapshot";
import { findInviteByToken } from "@/lib/invites";
import { publishedRounds } from "@/lib/loopTemplates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interview submitted — inturview", robots: { index: false, follow: false } };

/** Submission confirmation. Shown once every round is in, whether or not scoring has finished. */
export default async function DonePage({ params }: { params: { token: string } }) {
  const found = await findInviteByToken(params.token);
  if (!found.ok) redirect(`/i/${params.token}`);
  const { invite } = found;
  const company = invite.campaign.organization;
  const [snapshot, run] = await Promise.all([
    campaignSnapshot(invite.campaign),
    prisma.loopRun.findUnique({ where: { inviteId: invite.id }, select: { rounds: { select: { status: true, completedAt: true } } } }),
  ]);
  const total = publishedRounds(snapshot).length;
  const submitted = (run?.rounds ?? []).filter((r) => r.status !== "IN_PROGRESS");
  if (invite.status !== "COMPLETED" && (total === 0 || submitted.length < total)) redirect(`/i/${params.token}`);

  const at = submitted.map((r) => r.completedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? invite.completedAt;
  const when = at ? companyTime(at, company?.timezone ?? "UTC") : null;
  const contact = contactFor(company);
  const who = company?.name ?? "The hiring team";

  return (
    <ApplicantShell company={company} preview={invite.campaign.preview}>
      <div className="w-full max-w-xl mx-auto panel p-7 space-y-4" role="status">
        <CheckCircle2 className="h-8 w-8 text-easy" aria-hidden="true" />
        <h1 className="t-section-headline text-3xl">Your interview is submitted</h1>
        <p className="text-sm text-text-muted">
          {who} has your answers{when ? `, submitted ${when}` : ""}. There&apos;s nothing else to do, and you can close this page.
        </p>
        <ul className="text-sm text-text-muted space-y-2 list-disc pl-5">
          <li>People at {company?.name ?? "the company"} review it and decide on next steps. They&apos;ll contact you directly.</li>
          <li>You won&apos;t see a score here. Assessments go to the hiring team only.</li>
          <li>
            Your answers are kept {retentionText(company)}. To have them deleted sooner, contact{" "}
            {contact.href ? <a className="underline underline-offset-2" href={contact.href}>{contact.label}</a> : contact.label}.
          </li>
        </ul>
        {invite.campaign.preview && company?.slug && (
          <a href={`/hire/${company.slug}/candidates/${invite.id}`} className="btn btn-primary w-full justify-center">
            See how this preview was scored
          </a>
        )}
      </div>
    </ApplicantShell>
  );
}
