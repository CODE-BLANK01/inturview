import { CandidateView } from "@/components/hiring/views/InviteViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidate — inturview admin" };

export default function Page({ params }: { params: { id: string; inviteId: string } }) {
  return <CandidateView organizationId={null} paths={ADMIN_PATHS} campaignId={params.id} inviteId={params.inviteId} canRescore={false} />;
}
