import { LoopsView } from "@/components/hiring/views/LoopViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const dynamic = "force-dynamic";
export const metadata = { title: "Template loops — inturview admin" };

export default function Page() {
  return <LoopsView organizationId={null} paths={ADMIN_PATHS} />;
}
