import { CandidateView } from "@/components/hiring/views/InviteViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string; id: string; inviteId: string } }) {
  const access = await requireWorkspace(params.org, "applications.viewAll");
  const paths = workspacePaths(access.org.slug);
  return (
    <CandidateView
      organizationId={access.org.id}
      paths={paths}
      campaignId={params.id}
      inviteId={params.inviteId}
      canRescore={!!access.role && accessAllows(access, "applications.rescore")}
    />
  );
}
