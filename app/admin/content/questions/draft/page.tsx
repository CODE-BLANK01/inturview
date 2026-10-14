import { QuestionDraftView } from "@/components/hiring/views/QuestionViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const metadata = { title: "Draft questions with AI — inturview admin" };

export default function Page() {
  return <QuestionDraftView paths={ADMIN_PATHS} />;
}
