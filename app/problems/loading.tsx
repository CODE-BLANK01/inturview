import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ProblemsLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 space-y-2">
          <Skeleton h={32} className="w-56" />
          <Skeleton h={14} className="w-96 max-w-full" />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-4">
            <div className="panel p-4 space-y-2">
              <Skeleton h={10} className="w-16 mb-3" />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} h={14} className="w-full" />
              ))}
            </div>
            <div className="panel p-4 space-y-2">
              <Skeleton h={10} className="w-20 mb-3" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton h={22} w={50} className="rounded-full" />
                <Skeleton h={22} w={54} className="rounded-full" />
                <Skeleton h={22} w={60} className="rounded-full" />
                <Skeleton h={22} w={50} className="rounded-full" />
              </div>
            </div>
          </aside>

          <section>
            <Skeleton h={38} className="mb-4 w-full" />
            <div className="panel divide-y divide-border overflow-hidden">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton h={20} w={20} className="rounded-full" />
                  <Skeleton h={14} className="flex-1" />
                  <Skeleton h={20} w={60} className="rounded-full" />
                  <Skeleton h={20} w={120} className="rounded-full hidden sm:block" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
