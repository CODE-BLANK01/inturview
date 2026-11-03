import { LoopNewView } from "@/components/hiring/views/LoopViews";
import { ADMIN_PATHS } from "@/lib/hiring/paths";

export const metadata = { title: "New template loop — inturview admin" };

export default function Page() {
  return <LoopNewView paths={ADMIN_PATHS} />;
}
