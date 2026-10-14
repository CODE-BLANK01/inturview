import Link from "next/link";
import { Plus } from "lucide-react";
import type { InviteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { funnelFrom } from "@/lib/campaignStats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invites — inturview admin" };

export default async function CampaignsPage() {
  const [campaigns, counts] = await Promise.all([
    prisma.campaign.findMany({
      where: { organizationId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, deadline: true, loopVersion: true, loopTemplate: { select: { name: true } } },
    }),
    prisma.invite.groupBy({ by: ["campaignId", "status"], _count: true }),
  ]);
  const byCampaign = new Map<string, Partial<Record<InviteStatus, number>>>();
  for (const c of counts) byCampaign.set(c.campaignId, { ...byCampaign.get(c.campaignId), [c.status]: c._count });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
          <p className="text-sm text-text-muted mt-1">Each campaign sends one published loop to a group of candidates.</p>
        </div>
        <Link href="/admin/campaigns/new" className="btn btn-primary text-sm"><Plus className="h-4 w-4" /> Invite candidates</Link>
      </header>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Campaign", "Invited", "Opened", "Started", "Finished", "Sent"].map((h, i) => (
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
                      <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:underline underline-offset-2">{c.name}</Link>
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
