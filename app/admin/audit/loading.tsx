import {
  AdminPageHeading,
  AdminTableSkeleton,
} from "@/components/admin/AdminLoadingFragments";

export default function AdminAuditLoading() {
  return (
    <div className="space-y-6">
      <AdminPageHeading titleW={140} subW={480} />
      <AdminTableSkeleton cols={5} rows={12} toolbar={false} />
    </div>
  );
}
