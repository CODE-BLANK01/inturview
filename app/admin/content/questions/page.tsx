import { QuestionsView } from "@/components/hiring/views/QuestionViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question library — inturview admin" };

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <QuestionsView organizationId={null} paths={ADMIN_PATHS} searchParams={searchParams} />;
}
