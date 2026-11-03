import { LoopsView } from "@/components/hiring/views/LoopViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org, "loops.edit");
  const paths = workspacePaths(access.org.slug);
  return <LoopsView organizationId={access.org.id} paths={paths} />;
}
