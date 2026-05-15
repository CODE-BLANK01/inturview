import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/ui/Skeleton";

export default function HistoryLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-8 space-y-2">
          <Skeleton h={32} className="w-48" />
          <Skeleton h={14} className="w-80" />
        </header>

        <div className="panel divide-y divide-border overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton h={14} className="w-48" />
                  <Skeleton h={20} w={50} className="rounded-full" />
                  <Skeleton h={20} w={110} className="rounded-full hidden sm:block" />
                </div>
                <Skeleton h={10} className="w-44" />
              </div>
              <Skeleton h={18} w={48} />
              <Skeleton h={22} w={80} className="rounded-full" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
