interface SkeletonProps {
  className?: string;
  /** Inline width override — accepts any CSS length value. */
  w?: string | number;
  /** Inline height override. */
  h?: string | number;
}

export function Skeleton({ className, w, h }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (typeof w !== "undefined") style.width = typeof w === "number" ? `${w}px` : w;
  if (typeof h !== "undefined") style.height = typeof h === "number" ? `${h}px` : h;
  return <div className={`skeleton ${className ?? ""}`} style={style} />;
}

/** Row of skeleton cells — used inside table loading states. */
export function SkeletonRow({ cells = 5 }: { cells?: number }) {
  return (
    <tr className="border-b border-border last:border-0">
      {Array.from({ length: cells }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Skeleton h={14} className={i === 0 ? "w-1/2" : "w-3/4"} />
        </td>
      ))}
    </tr>
  );
}
