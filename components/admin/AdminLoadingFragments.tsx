import { Skeleton } from "@/components/ui/Skeleton";

export function AdminPageHeading({
  titleW = 200,
  subW = 360,
}: {
  titleW?: number | string;
  subW?: number | string;
}) {
  return (
    <header className="space-y-2">
      <Skeleton h={28} w={titleW} />
      <Skeleton h={14} w={subW} />
    </header>
  );
}

export function AdminTableSkeleton({
  cols = 6,
  rows = 8,
  toolbar = true,
}: {
  cols?: number;
  rows?: number;
  toolbar?: boolean;
}) {
  return (
    <div className="space-y-3">
      {toolbar && (
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <Skeleton h={36} className="w-full sm:max-w-md" />
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} h={22} w={66} className="rounded-full" />
            ))}
          </div>
        </div>
      )}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border">
                {Array.from({ length: cols }).map((_, i) => (
                  <th key={i} className="px-4 py-2.5 text-left">
                    <Skeleton h={10} className="w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, r) => (
                <tr key={r} className="border-b border-border last:border-0">
                  {Array.from({ length: cols }).map((_, c) => (
                    <td key={c} className="px-4 py-3.5">
                      <Skeleton h={14} className={c === 0 ? "w-2/3" : "w-1/2"} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
