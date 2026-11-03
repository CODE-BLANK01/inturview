import { LoopDetailView } from "@/components/hiring/views/LoopViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit template loop — inturview admin" };

export default function Page({ params }: { params: { id: string } }) {
  return <LoopDetailView organizationId={null} paths={ADMIN_PATHS} id={params.id} canInvite={false} />;
}
