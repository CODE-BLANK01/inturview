import { RoleDetailView } from "@/components/hiring/views/RoleViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string; id: string } }) {
  const access = await requireWorkspace(params.org, "applications.viewAll");
  return (
    <RoleDetailView
      organizationId={access.org.id}
      paths={workspacePaths(access.org.slug)}
      id={params.id}
      canEdit={!!access.role && accessAllows(access, "roles.edit")}
      canSend={!!access.role && accessAllows(access, "invitations.send")}
    />
  );
}
