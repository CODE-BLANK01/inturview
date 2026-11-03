import { LoopDetailView } from "@/components/hiring/views/LoopViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string; id: string } }) {
  const access = await requireWorkspace(params.org, "loops.edit");
  const paths = workspacePaths(access.org.slug);
  return <LoopDetailView organizationId={access.org.id} paths={paths} id={params.id} canInvite={accessAllows(access, "invitations.send")} />;
}
