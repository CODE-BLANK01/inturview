import { Skeleton } from "@/components/ui/Skeleton";
export function LoopLoading({ builder = false }: { builder?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading loop">
      <span className="sr-only" role="status">
        Loading your loop…
      </span>
      <div className="loop-heading">
        <Skeleton w="10rem" h={12} />
        <Skeleton w="75%" h={48} className="mt-4" />
        <Skeleton w="40%" h={20} className="mt-4" />
      </div>
      {builder ? (
        <div className="loop-builder">
          <Skeleton h={680} />
          <Skeleton h={680} />
        </div>
      ) : (
        <>
          <Skeleton h={130} />
          <Skeleton h={230} className="my-6" />
          <div className="loop-round-grid">
            <Skeleton h={400} />
            <Skeleton h={400} />
          </div>
        </>
      )}
    </div>
  );
}
