import { InvitesView } from "@/components/hiring/views/InviteViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org, "applications.viewAll");
  const paths = workspacePaths(access.org.slug);
  return <InvitesView organizationId={access.org.id} paths={paths} canSend={!!access.role && accessAllows(access, "invitations.send")} />;
}
