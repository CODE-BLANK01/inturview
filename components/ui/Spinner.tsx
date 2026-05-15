import { Loader2 } from "lucide-react";

export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Loader2
      className={`animate-spin text-accent ${className ?? ""}`}
      style={{ height: size, width: size }}
      aria-label="Loading"
    />
  );
}
