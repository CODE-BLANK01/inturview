import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { prisma } from "@/lib/db";
import { accessAllows } from "@/lib/workspaces";
import { requireWorkspace } from "@/lib/workspaceGuard";

export const dynamic = "force-dynamic";

export default async function WorkspaceOverview({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org);
  const { org } = access;
  const now = new Date();
  const seesCandidates = accessAllows(access, "applications.viewAll");
  const [members, pending, publishedLoops, roles, invited, finished, needsAttention] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId: org.id } }),
    prisma.memberInvitation.count({ where: { organizationId: org.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
    prisma.loopTemplate.count({ where: { organizationId: org.id, status: "PUBLISHED" } }),
    prisma.hiringRole.count({ where: { organizationId: org.id } }),
    prisma.invite.count({ where: { campaign: { organizationId: org.id, preview: false } } }),
    // Finished and not yet decided.
    seesCandidates ? prisma.invite.count({ where: { campaign: { organizationId: org.id, preview: false }, status: "COMPLETED", decision: null } }) : 0,
    // Emails that bounced and rounds whose scoring didn't finish.
    seesCandidates
      ? prisma.invite.count({
          where: { campaign: { organizationId: org.id, preview: false }, OR: [{ status: "FAILED" }, { run: { rounds: { some: { status: "SCORING_FAILED" } } } }] },
        })
      : 0,
  ]);
  const canEdit = accessAllows(access, "workspace.editProfile");
  const canInvite = accessAllows(access, "members.manageStaff");
  const canBuild = accessAllows(access, "loops.edit");
  const canSend = accessAllows(access, "invitations.send");
  const base = `/hire/${org.slug}`;
  const myReviews = access.role
    ? await prisma.reviewerAssignment.count({
        where: { userId: access.user.id, invite: { campaign: { organizationId: org.id, preview: false }, status: { not: "REVOKED" }, reviews: { none: { authorId: access.user.id, kind: "RATING" } } } },
      })
    : 0;

  // Setup the company can finish today.
  const steps = [
    { done: !!org.contactEmail && org.timezone !== "UTC", label: "Add a contact email and your timezone", href: `${base}/settings`, show: canEdit },
    { done: members > 1 || pending > 0, label: "Invite a teammate", href: `${base}/team`, show: canInvite },
    { done: publishedLoops > 0, label: "Publish an interview loop", href: `${base}/loops`, show: canBuild },
    { done: roles > 0, label: "Create a role for the job you're hiring", href: `${base}/roles`, show: accessAllows(access, "roles.edit") },
    { done: invited > 0, label: "Invite your first candidates from the role", href: `${base}/roles`, show: canSend && publishedLoops > 0 && roles > 0 },
  ].filter((s) => s.show);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-sm text-text-muted mt-1">
          {members} {members === 1 ? "teammate" : "teammates"}
          {pending > 0 && ` · ${pending} invitation${pending === 1 ? "" : "s"} pending`}
          {org.designPartner && " · Design partner"}
        </p>
      </header>

      {myReviews > 0 && (
        <Link href={`${base}/reviews`} className="panel p-4 flex items-center justify-between hover:border-accent/40">
          <span className="text-sm font-medium">{myReviews} candidate{myReviews === 1 ? "" : "s"} waiting for your rating</span>
          <ArrowRight className="h-4 w-4 text-text-dim" />
        </Link>
      )}

      {/* Setup gives way to the real work once it's done. */}
      {steps.some((s) => !s.done) && (
        <section className="panel p-5 space-y-3" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="text-sm font-semibold">Set up your workspace</h2>
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-2.5 text-sm group">
                  {s.done ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Circle className="h-4 w-4 text-text-dim" />}
                  <span className={s.done ? "text-text-muted line-through decoration-text-dim" : ""}>{s.label}</span>
                  {!s.done && <ArrowRight className="h-3.5 w-3.5 text-text-dim group-hover:text-text" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {seesCandidates && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label="Candidates">
          {[
            { n: invited, label: "Candidates invited", href: `${base}/candidates` },
            { n: finished, label: "Ready for review", href: `${base}/candidates?stage=ready` },
            { n: needsAttention, label: "Need attention", href: `${base}/candidates?stage=needs_attention`, warn: needsAttention > 0 },
          ].map((c) => (
            <Link key={c.label} href={c.href} className="panel p-4 hover:border-accent/40">
              <div className={`text-2xl font-semibold tabular-nums ${c.warn ? "text-hard" : ""}`}>{c.n}</div>
              <div className="text-xs text-text-dim">{c.label}</div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
