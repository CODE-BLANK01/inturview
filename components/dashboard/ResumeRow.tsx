import Link from "next/link";
import { ArrowRight, Code2, MessageSquare, Network, Users, Video } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";

const modeIcons: Record<string, typeof Code2> = {
  Coding: Code2,
  "System design": Network,
  Behavioral: Users,
  "Recruiter screen": MessageSquare,
  "Face-to-face": Video,
};

export function ResumeRow({
  inProgress,
  suggestion,
}: {
  inProgress: DashboardData["inProgress"];
  suggestion: DashboardData["suggestion"];
}) {
  const href =
    inProgress?.href ??
    (suggestion ? `/interview/${suggestion.problemId}` : "/recruiter-screen");
  const mode = inProgress?.mode ?? (suggestion ? "Coding" : "Recruiter screen");
  const Icon = modeIcons[mode] ?? MessageSquare;
  const description = inProgress
    ? (inProgress.title === mode ? null : mode)
    : suggestion?.reason ?? "Practice your introduction and career story.";

  return (
    <section className="welcome-resume" aria-labelledby="next-round-heading">
      <span className="resume-mode-icon" aria-hidden="true">
        <Icon size={23} strokeWidth={1.5} />
      </span>
      <div className="resume-context">
        <p className="resume-label">
          {inProgress ? "In progress" : suggestion ? "Recommended next" : "Start here"}
        </p>
        <h2 id="next-round-heading">
          {inProgress?.title ?? suggestion?.title ?? "Your first recruiter screen"}
        </h2>
        {description && <p className="resume-description">{description}</p>}
        <Link href={href} className="resume-link">
          {inProgress ? "Continue interview" : "Start practicing"}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
