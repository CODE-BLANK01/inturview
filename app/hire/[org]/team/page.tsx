import { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canManageRole, ROLE_LABELS } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { InviteTeammateForm, MemberControls, ResendInvitationButton, RevokeInvitationButton } from "@/components/hire/TeamControls";

export const dynamic = "force-dynamic";

const ALL_ROLES = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.RECRUITER, OrgRole.REVIEWER];
const dateFmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function TeamPage({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org);
  const { org, role: myRole, user } = access;
  const now = new Date();
  const [members, invitations] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: org.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true, role: true, createdAt: true, userId: true, user: { select: { name: true, email: true } } },
    }),
    prisma.memberInvitation.findMany({
      where: { organizationId: org.id, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
  ]);
  const invitable = myRole ? ALL_ROLES.filter((r) => canManageRole(myRole, r)) : [];
  // The last owner can't step down or leave; don't offer it.
  const soleOwner = members.filter((m) => m.role === OrgRole.OWNER).length === 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-text-muted mt-1">Everyone here can see this workspace. Nobody gets in by email domain alone.</p>
      </header>

      {invitable.length > 0 && <InviteTeammateForm slug={org.slug} roles={invitable} />}

      <section className="panel overflow-hidden" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-sm font-semibold px-4 pt-4 pb-2">Members</h2>
        <ul>
          {members.map((m) => {
            const isSelf = m.userId === user.id;
            const locked = soleOwner && m.role === OrgRole.OWNER;
            const manageable = !!myRole && canManageRole(myRole, m.role) && !locked;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.user.name || m.user.email} {isSelf && <span className="text-xs text-text-dim">(you)</span>}
                  </div>
                  <div className="text-xs text-text-dim truncate">{m.user.email} · joined {dateFmt(m.createdAt)}</div>
                </div>
                {myRole ? (
                  <MemberControls
                    slug={org.slug}
                    memberId={m.id}
                    role={m.role}
                    assignable={manageable ? invitable : []}
                    isSelf={isSelf && !locked}
                    canRemove={manageable}
                  />
                ) : (
                  <span className="text-xs text-text-muted">{ROLE_LABELS[m.role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {invitations.length > 0 && (
        <section className="panel overflow-hidden" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-sm font-semibold px-4 pt-4 pb-2">Pending invitations</h2>
          <ul>
            {invitations.map((i) => {
              const expired = i.expiresAt <= now;
              const manageable = !!myRole && canManageRole(myRole, i.role);
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{i.email}</div>
                    <div className={`text-xs ${expired ? "text-hard" : "text-text-dim"}`}>
                      {ROLE_LABELS[i.role]} · {expired ? `expired ${dateFmt(i.expiresAt)}` : `expires ${dateFmt(i.expiresAt)}`}
                    </div>
                  </div>
                  {manageable && (
                    <span className="inline-flex gap-2">
                      <ResendInvitationButton slug={org.slug} email={i.email} role={i.role} />
                      <RevokeInvitationButton slug={org.slug} id={i.id} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
