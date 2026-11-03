import { QuestionNewView } from "@/components/hiring/views/QuestionViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const metadata = { title: "New question — inturview admin" };

export default function Page() {
  return <QuestionNewView paths={ADMIN_PATHS} />;
}
