import { QuestionDetailView } from "@/components/hiring/views/QuestionViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit question — inturview admin" };

export default function Page({ params }: { params: { id: string } }) {
  return <QuestionDetailView organizationId={null} paths={ADMIN_PATHS} id={params.id} />;
}
