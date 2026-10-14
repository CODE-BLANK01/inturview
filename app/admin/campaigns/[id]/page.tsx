import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { InviteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { funnelFrom } from "@/lib/campaignStats";
import { AddCandidates, CampaignSendButtons, InviteRowActions } from "@/components/admin/CampaignActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaign — inturview admin" };

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

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: { loopTemplate: { select: { id: true, name: true } }, invites: { orderBy: { createdAt: "asc" }, include: { run: { select: { overallScore: true } } } } },
  });
  if (!campaign) notFound();
  const counts: Partial<Record<InviteStatus, number>> = {};
  for (const i of campaign.invites) counts[i.status] = (counts[i.status] ?? 0) + 1;
  const f = funnelFrom(counts);
  const pct = (n: number) => (f.sent ? `${Math.round((n / f.sent) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <Link href="/admin/campaigns" className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Invites
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="text-sm text-text-muted">
          <Link className="underline underline-offset-2" href={`/admin/loops/${campaign.loopTemplate.id}`}>{campaign.loopTemplate.name}</Link> · version {campaign.loopVersion}
          {campaign.deadline && <> · deadline {day(campaign.deadline)}</>}
        </p>
      </header>

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CampaignSendButtons campaignId={campaign.id} pending={f.pending} failed={f.failed} />
        <AddCandidates campaignId={campaign.id} />
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Candidate", "Status", "Score", "Sent", "Finished", ""].map((h) => (
                  <th key={h} className="font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaign.invites.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/campaigns/${campaign.id}/candidates/${i.id}`} className="font-medium hover:underline underline-offset-2">{i.name ?? i.email}</Link>
                    {i.name && <div className="text-xs text-text-dim">{i.email}</div>}
                    {i.status === "FAILED" && i.lastError && <div className="text-xs text-hard mt-0.5">{i.lastError}</div>}
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${PILL[i.status]}`}>{LABEL[i.status]}</span>{i.sendCount > 1 && <span className="ml-1 text-xs text-text-dim">×{i.sendCount}</span>}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{i.run?.overallScore ?? <span className="font-normal text-text-dim">—</span>}</td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">{day(i.sentAt)}</td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">{day(i.completedAt)}</td>
                  <td className="px-4 py-3"><InviteRowActions inviteId={i.id} status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
