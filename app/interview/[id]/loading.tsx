import { TopNav } from "@/components/TopNav";
import { Skeleton } from "@/components/ui/Skeleton";

export default function InterviewLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Skeleton h={14} w={90} />
            <Skeleton h={14} w={120} />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton h={20} w={70} />
            <Skeleton h={20} w={200} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[70vh]">
          <div className="panel p-5 space-y-3">
            <Skeleton h={22} w={80} className="rounded-full" />
            <Skeleton h={24} className="w-64" />
            <Skeleton h={12} className="w-full" />
            <Skeleton h={12} className="w-5/6" />
            <Skeleton h={12} className="w-2/3" />
            <div className="pt-4 space-y-2">
              <Skeleton h={12} className="w-32" />
              <Skeleton h={32} className="w-full" />
              <Skeleton h={32} className="w-full" />
            </div>
          </div>

          <div className="panel p-4 space-y-3 min-h-[70vh]">
            <Skeleton h={42} className="w-3/4" />
            <Skeleton h={42} className="w-1/2 ml-auto" />
            <Skeleton h={42} className="w-2/3" />
            <div className="mt-auto pt-3 border-t border-border">
              <Skeleton h={56} className="w-full" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
