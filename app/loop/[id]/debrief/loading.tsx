import { Skeleton } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading debrief">
      <Skeleton h={130} />
      <Skeleton h={300} className="my-6" />
      <div className="loop-round-grid">
        <Skeleton h={440} />
        <Skeleton h={440} />
      </div>
    </div>
  );
}
