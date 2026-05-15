import {
  AdminPageHeading,
  AdminTableSkeleton,
} from "@/components/admin/AdminLoadingFragments";

export default function AdminUsersLoading() {
  return (
    <div className="space-y-6">
      <AdminPageHeading titleW={120} subW={460} />
      <AdminTableSkeleton cols={6} rows={10} />
    </div>
  );
}
