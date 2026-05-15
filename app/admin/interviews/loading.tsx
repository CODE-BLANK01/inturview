import { Skeleton } from "@/components/ui/Skeleton";
import {
  AdminPageHeading,
  AdminTableSkeleton,
} from "@/components/admin/AdminLoadingFragments";

export default function AdminInterviewsLoading() {
  return (
    <div className="space-y-6">
      <AdminPageHeading titleW={140} subW={520} />
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} h={22} w={86} className="rounded-full" />
        ))}
      </div>
      <AdminTableSkeleton cols={7} rows={10} toolbar={false} />
    </div>
  );
}
