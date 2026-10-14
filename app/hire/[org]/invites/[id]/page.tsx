import { CampaignView } from "@/components/hiring/views/InviteViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string; id: string } }) {
  const access = await requireWorkspace(params.org, "applications.viewAll");
  const paths = workspacePaths(access.org.slug);
  return <CampaignView organizationId={access.org.id} paths={paths} id={params.id} canSend={!!access.role && accessAllows(access, "invitations.send")} />;
}
