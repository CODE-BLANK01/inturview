import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <header className="mb-8 space-y-2">
          <Skeleton h={34} className="w-72 max-w-full" />
          <Skeleton h={16} className="w-96 max-w-full" />
        </header>

        <div className="space-y-6">
          {/* Stat strip */}
          <div className="panel flex divide-x divide-border overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 flex-1 min-w-[140px] space-y-2">
                <Skeleton h={10} className="w-20" />
                <Skeleton h={28} className="w-16" />
                <Skeleton h={10} className="w-28" />
              </div>
            ))}
          </div>

          {/* Resume row */}
          <div className="panel p-5">
            <div className="flex items-center gap-4">
              <Skeleton h={40} w={40} className="rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton h={10} className="w-20" />
                <Skeleton h={20} className="w-72" />
                <Skeleton h={10} className="w-40" />
              </div>
              <Skeleton h={36} w={140} />
            </div>
          </div>

          {/* Practice mode cards */}
          <div>
            <Skeleton h={12} className="w-32 mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="panel p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton h={36} w={36} />
                    <Skeleton h={20} w={70} className="rounded-full" />
                  </div>
                  <Skeleton h={16} className="w-32" />
                  <Skeleton h={12} className="w-full" />
                  <Skeleton h={12} className="w-3/4" />
                </div>
              ))}
            </div>
          </div>

          {/* Two-column bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-6 min-w-0">
              <div className="panel p-5 space-y-3">
                <Skeleton h={16} className="w-40" />
                <Skeleton h={10} className="w-64" />
                <div className="space-y-2.5 pt-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[1fr_72px_56px] gap-3 items-center">
                      <div className="space-y-1.5">
                        <Skeleton h={12} className="w-32" />
                        <Skeleton h={6} className="w-full" />
                      </div>
                      <Skeleton h={10} className="w-12 justify-self-end" />
                      <Skeleton h={10} className="w-12 justify-self-end" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-5 space-y-3">
                <Skeleton h={16} className="w-40" />
                <div className="space-y-2 pt-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <Skeleton h={14} className="flex-1" />
                      <Skeleton h={10} w={60} />
                      <Skeleton h={20} w={70} className="rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel p-5 space-y-3">
              <Skeleton h={16} className="w-32" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-1">
                  <Skeleton h={32} w={32} />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton h={12} className="w-3/4" />
                    <Skeleton h={10} className="w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
