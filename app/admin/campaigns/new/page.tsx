import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { parseRounds, totalMinutes } from "@/lib/loopTemplates";
import { NewCampaignForm } from "@/components/admin/NewCampaignForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite candidates — inturview admin" };

export default async function NewCampaignPage({ searchParams }: { searchParams: { loop?: string } }) {
  const loops = await prisma.loopTemplate.findMany({
    where: { organizationId: null, status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, currentVersion: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } },
  });
  const options = loops.map((l) => {
    const snap = l.versions[0]?.snapshot as { config?: { rounds?: unknown } } | undefined;
    const rounds = parseRounds(snap?.config?.rounds ?? []);
    return { id: l.id, name: l.name, version: l.currentVersion, rounds: (snap?.config?.rounds as unknown[] | undefined)?.length ?? 0, minutes: totalMinutes(rounds) };
  });
  return (
    <div className="space-y-6">
      <Link href="/admin/campaigns" className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Invites
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Invite candidates</h1>
        <p className="text-sm text-text-muted mt-1">Everyone gets a personal link by email. Candidates don&apos;t need an account.</p>
      </header>
      <NewCampaignForm loops={options} defaultLoopId={searchParams.loop} />
    </div>
  );
}
