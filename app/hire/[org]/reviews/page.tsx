import Link from "next/link";
import { prisma } from "@/lib/db";
import { STAGE_LABEL, STAGE_PILL } from "@/lib/candidateStage";
import { listCandidates } from "@/lib/hiring/candidates";
import { workspacePaths } from "@/lib/hiring/paths";
import { requireWorkspace } from "@/lib/workspaceGuard";

export const dynamic = "force-dynamic";

/** Candidates assigned to the viewer. This is a reviewer's whole view of the workspace's candidates. */
export default async function ReviewsPage({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org, "applications.review");
  const paths = workspacePaths(access.org.slug);
  const rows = await listCandidates(access.org.id, { assignedTo: access.user.id });
  const rated = new Set(
    (await prisma.review.findMany({ where: { authorId: access.user.id, kind: "RATING", inviteId: { in: rows.map((r) => r.id) } }, select: { inviteId: true } })).map((r) => r.inviteId),
  );
  const todo = rows.filter((r) => !rated.has(r.id) && r.stage !== "cancelled");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My reviews</h1>
        <p className="text-sm text-text-muted mt-1">
          {rows.length ? `${todo.length} of ${rows.length} assigned to you still need your rating.` : "Nothing is assigned to you yet."}
        </p>
      </header>
      <div className="panel overflow-hidden">
        <ul>
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0">
              <div className="min-w-0">
                <Link href={`${paths.candidates}/${c.id}`} className="font-medium hover:underline underline-offset-2">{c.name ?? c.email}</Link>
                <div className="text-xs text-text-dim">{c.role?.title ?? "No role"}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge whitespace-nowrap ${STAGE_PILL[c.stage]}`}>{STAGE_LABEL[c.stage]}</span>
                <span className={`text-xs ${rated.has(c.id) ? "text-text-dim" : "text-medium"}`}>{rated.has(c.id) ? "Rated" : "Needs your rating"}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
