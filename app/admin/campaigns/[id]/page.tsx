import { CampaignView } from "@/components/hiring/views/InviteViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Legacy invites — inturview admin" };

export default function Page({ params }: { params: { id: string } }) {
  return <CampaignView organizationId={null} paths={ADMIN_PATHS} id={params.id} canSend={false} />;
}
