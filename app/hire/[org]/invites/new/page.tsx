import { InviteNewView } from "@/components/hiring/views/InviteViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: { org: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const access = await requireWorkspace(params.org, "invitations.send");
  const paths = workspacePaths(access.org.slug);
  const loop = typeof searchParams.loop === "string" ? searchParams.loop : undefined;
  return <InviteNewView organizationId={access.org.id} paths={paths} defaultLoopId={loop} />;
}
