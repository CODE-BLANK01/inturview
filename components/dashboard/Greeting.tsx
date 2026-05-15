import type { DashboardData } from "@/lib/dashboard";

export function Greeting({
  name,
  stats,
}: {
  name: string | null;
  stats: DashboardData["stats"];
}) {
  const hour = new Date().getHours();
  const timeOfDay =
    hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = (name ?? "").split(/\s+/)[0] || null;

  let sub: string;
  if (stats.interviewsCompleted === 0) {
    sub = "First mock is the toughest. Pick something light to find the rhythm.";
  } else if (stats.interviewsCompleted < 5) {
    sub = `${stats.interviewsCompleted} interviews in. Build the streak.`;
  } else if (stats.averageScore !== null) {
    sub = `Average ${stats.averageScore.toFixed(1)}/25 across ${stats.interviewsCompleted} interviews${
      stats.strongestTopic ? ` — strongest in ${stats.strongestTopic.name}.` : "."
    }`;
  } else {
    sub = "Pick up where you left off.";
  }

  return (
    <header className="mb-8">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        {timeOfDay}
        {first ? `, ${first}` : ""}
        <span className="text-text-dim">.</span>
      </h1>
      <p className="mt-2 text-text-muted text-base">{sub}</p>
    </header>
  );
}
