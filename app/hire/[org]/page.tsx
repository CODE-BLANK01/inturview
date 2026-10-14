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
  const [members, pending] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId: org.id } }),
    prisma.memberInvitation.count({ where: { organizationId: org.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
  ]);
  const canEdit = accessAllows(access, "workspace.editProfile");
  const canInvite = accessAllows(access, "members.manageStaff");

  // Setup the company can finish today. Roles and loops are added here as they ship.
  const steps = [
    { done: !!org.contactEmail && org.timezone !== "UTC", label: "Add a contact email and your timezone", href: `/hire/${org.slug}/settings`, show: canEdit },
    { done: members > 1 || pending > 0, label: "Invite a teammate", href: `/hire/${org.slug}/team`, show: canInvite },
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

      {steps.length > 0 && (
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

      <section className="panel p-5">
        <h2 className="text-sm font-semibold">Coming next</h2>
        <p className="text-sm text-text-muted mt-1">
          Hiring roles, interview loops and the review queue arrive in this workspace next. Until then, the inturview
          team sets up your interviews with you.
        </p>
      </section>
    </div>
  );
}
