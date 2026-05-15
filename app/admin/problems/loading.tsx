import {
  AdminPageHeading,
  AdminTableSkeleton,
} from "@/components/admin/AdminLoadingFragments";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminProblemsLoading() {
  return (
    <div className="space-y-6">
      <AdminPageHeading titleW={140} subW={500} />
      <div className="flex items-center justify-between">
        <Skeleton h={14} w={120} />
        <Skeleton h={36} w={150} />
      </div>
      <AdminTableSkeleton cols={6} rows={10} toolbar={false} />
    </div>
  );
}
