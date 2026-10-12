import Link from "next/link";
import { Plus } from "lucide-react";
import { LoopStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { estimateLoopCost, parseRounds, totalMinutes } from "@/lib/loopTemplates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Loops — inturview admin" };

const PILL: Record<LoopStatus, string> = {
  PUBLISHED: "border-easy/40 bg-easy/10 text-easy",
  DRAFT: "border-medium/40 bg-medium/10 text-medium",
  ARCHIVED: "border-border bg-bg-inset text-text-dim",
};

export default async function AdminLoopsPage() {
  const loops = await prisma.loopTemplate.findMany({
    where: { organizationId: null },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, roleTarget: true, level: true, rounds: true, status: true, currentVersion: true },
  });
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loops</h1>
          <p className="text-sm text-text-muted mt-1">Interview journeys: ordered rounds candidates go through after an invite.</p>
        </div>
        <Link href="/admin/loops/new" className="btn btn-primary text-sm"><Plus className="h-4 w-4" /> New loop</Link>
      </header>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Loop", "Rounds", "Time", "Est. cost", "Status", "Version"].map((h, i) => (
                  <th key={h} className={`font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 ${i > 0 && i !== 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loops.map((l) => {
                const rounds = parseRounds(l.rounds);
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-bg-inset/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/loops/${l.id}`} className="font-medium hover:underline underline-offset-2">{l.name}</Link>
                      {(l.roleTarget || l.level) && <span className="ml-2 text-xs text-text-dim">{[l.roleTarget, l.level].filter(Boolean).join(" · ")}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{rounds.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{totalMinutes(rounds)} min</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">${estimateLoopCost(rounds).totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-3"><span className={`badge ${PILL[l.status]}`}>{l.status.toLowerCase()}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">{l.currentVersion || "—"}</td>
                  </tr>
                );
              })}
              {loops.length === 0 && (
                <tr><td colSpan={6} className="text-center text-text-dim py-8">No loops yet. Create one to start building an interview journey.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
