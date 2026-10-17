import { RolesView } from "@/components/hiring/views/RoleViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org, "applications.viewAll");
  return <RolesView organizationId={access.org.id} paths={workspacePaths(access.org.slug)} canEdit={!!access.role && accessAllows(access, "roles.edit")} />;
}
