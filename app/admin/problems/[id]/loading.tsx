import { Skeleton } from "@/components/ui/Skeleton";
import { AdminPageHeading } from "@/components/admin/AdminLoadingFragments";

export default function EditProblemLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <AdminPageHeading titleW={180} subW={360} />
      <div className="flex items-center justify-between">
        <Skeleton h={14} w={50} />
        <Skeleton h={36} w={140} />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <section key={i} className="panel p-5 space-y-3">
          <Skeleton h={12} w={100} />
          <Skeleton h={36} className="w-full" />
          {i === 1 && <Skeleton h={120} className="w-full" />}
          {i === 2 && (
            <>
              <Skeleton h={32} className="w-full" />
              <Skeleton h={32} className="w-full" />
            </>
          )}
        </section>
      ))}
    </div>
  );
}
