import type { Difficulty } from "@/lib/types";

export function DifficultyBadge({ value }: { value: Difficulty }) {
  const styles: Record<Difficulty, string> = {
    Easy: "border-easy/40 bg-easy/10 text-easy",
    Medium: "border-medium/40 bg-medium/10 text-medium",
    Hard: "border-hard/40 bg-hard/10 text-hard",
  };
  return <span className={`badge ${styles[value]}`}>{value}</span>;
}

export function TopicBadge({ value }: { value: string }) {
  return (
    <span className="badge border-border bg-bg-surface text-text-muted">{value}</span>
  );
}

export function RecommendationBadge({
  value,
}: {
  value: "Strong Hire" | "Hire" | "No Hire";
}) {
  const styles: Record<typeof value, string> = {
    "Strong Hire": "border-hire-strong/50 bg-hire-strong/15 text-hire-strong",
    Hire: "border-hire-normal/50 bg-hire-normal/15 text-hire-normal",
    "No Hire": "border-hire-no/50 bg-hire-no/15 text-hire-no",
  };
  return (
    <span className={`badge px-3 py-1 text-sm font-semibold ${styles[value]}`}>
      {value}
    </span>
  );
}
