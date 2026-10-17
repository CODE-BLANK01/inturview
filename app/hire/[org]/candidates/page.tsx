import { CandidatesView } from "@/components/hiring/views/RoleViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: { org: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const access = await requireWorkspace(params.org, "applications.viewAll");
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  return (
    <CandidatesView
      organizationId={access.org.id}
      paths={workspacePaths(access.org.slug)}
      canSend={!!access.role && accessAllows(access, "invitations.send")}
      stage={one(searchParams.stage)}
      roleId={one(searchParams.role)}
      page={Number(one(searchParams.page) ?? 1) || 1}
    />
  );
}
