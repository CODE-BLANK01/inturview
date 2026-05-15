import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/ui/Skeleton";

export default function HistoryDetailLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Skeleton h={14} className="w-32" />
          <Skeleton h={10} className="w-44" />
        </div>

        <header className="panel p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton h={20} w={50} className="rounded-full" />
            <Skeleton h={20} w={120} className="rounded-full" />
          </div>
          <Skeleton h={28} className="w-72" />
          <Skeleton h={12} className="w-full" />
          <Skeleton h={12} className="w-3/4" />
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="panel p-5 lg:col-span-3 space-y-3">
            <Skeleton h={18} className="w-40" />
            <Skeleton h={12} className="w-full" />
            <Skeleton h={12} className="w-5/6" />
            <Skeleton h={12} className="w-2/3" />
          </div>
          <div className="panel p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton h={18} className="w-32" />
              <Skeleton h={22} w={90} className="rounded-full" />
            </div>
            <Skeleton h={36} w={80} />
            <div className="space-y-3 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton h={12} className="w-32" />
                    <Skeleton h={10} className="w-10" />
                  </div>
                  <Skeleton h={6} className="w-full" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel p-5 space-y-3">
            <Skeleton h={18} className="w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} h={32} className="w-3/4" />
            ))}
          </div>
          <div className="panel p-5 space-y-3">
            <Skeleton h={18} className="w-40" />
            <Skeleton h={180} className="w-full" />
          </div>
        </section>
      </main>
    </>
  );
}
