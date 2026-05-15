import { Skeleton } from "@/components/ui/Skeleton";
import { AdminPageHeading } from "@/components/admin/AdminLoadingFragments";

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-8">
      <AdminPageHeading titleW={140} subW={420} />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 bg-bg-elevated space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton h={10} w={48} />
              <Skeleton h={14} w={14} className="rounded" />
            </div>
            <Skeleton h={28} w={56} />
            <Skeleton h={10} className="w-32" />
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, c) => (
          <section key={c} className="panel p-5 space-y-3">
            <Skeleton h={16} w={140} />
            <div className="space-y-2 pt-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <Skeleton h={20} w={70} className="rounded-full" />
                  <Skeleton h={14} className="flex-1" />
                  <Skeleton h={10} w={60} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
