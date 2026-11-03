import { QuestionNewView } from "@/components/hiring/views/QuestionViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org, "questions.edit");
  const paths = workspacePaths(access.org.slug);
  return <QuestionNewView paths={paths} />;
}
