import { QuestionsView } from "@/components/hiring/views/QuestionViews";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { workspacePaths } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: { org: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const access = await requireWorkspace(params.org, "questions.edit");
  const paths = workspacePaths(access.org.slug);
  return <QuestionsView organizationId={access.org.id} paths={paths} searchParams={searchParams} />;
}
