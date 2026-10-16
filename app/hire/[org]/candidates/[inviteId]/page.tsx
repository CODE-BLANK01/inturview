import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CandidateView } from "@/components/hiring/views/InviteViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { reviewPanel, visibleCandidate } from "@/lib/hiring/reviews";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string; inviteId: string } }) {
  const access = await requireWorkspace(params.org);
  const canViewAll = accessAllows(access, "applications.viewAll");
  // Reviewers reach only the candidates assigned to them.
  if (!(await visibleCandidate(access.org.id, params.inviteId, { userId: access.user.id, canViewAll }))) notFound();
  const member = !!access.role;
  // A teammate's preview: show how it was scored, but there's nobody to review or decide on.
  const isPreview = !!(await prisma.invite.findFirst({ where: { id: params.inviteId, campaign: { preview: true } }, select: { id: true } }));
  const can = (p: Parameters<typeof accessAllows>[1]) => member && accessAllows(access, p);
  return (
    <CandidateView
      organizationId={access.org.id}
      paths={workspacePaths(access.org.slug)}
      inviteId={params.inviteId}
      canRescore={can("applications.rescore")}
      review={isPreview ? undefined : {
        data: await reviewPanel(access.org.id, params.inviteId, access.user.id, can("applications.decide")),
        canReview: can("applications.review"),
        canDecide: can("applications.decide"),
        canAssign: can("reviewers.assign"),
      }}
    />
  );
}
