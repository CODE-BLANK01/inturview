import Link from "next/link";
import { ArrowUpRight, Infinity as InfinityIcon } from "lucide-react";
import type { PlanDefinition } from "@/lib/plans";

export function PlanUsage({
  plan,
  interviewsThisMonth,
  designSessionsThisMonth,
  behavioralSessionsThisMonth,
  recruiterSessionsThisMonth,
}: {
  plan: PlanDefinition;
  interviewsThisMonth: number;
  designSessionsThisMonth: number;
  behavioralSessionsThisMonth: number;
  recruiterSessionsThisMonth: number;
}) {
  const meters = [
    {
      label: "Recruiter",
      used: recruiterSessionsThisMonth,
      limit: plan.recruiterSessionsPerMonth,
    },
    {
      label: "Behavioral",
      used: behavioralSessionsThisMonth,
      limit: plan.behavioralSessionsPerMonth,
    },
    {
      label: "Coding",
      used: interviewsThisMonth,
      limit: plan.interviewsPerMonth,
    },
    {
      label: "Design",
      used: designSessionsThisMonth,
      limit: plan.designSessionsPerMonth,
    },
  ];
  const capped = meters.some((m) => m.limit !== null);
  return (
    <section className="plan-strip" aria-label="Your plan and monthly usage">
      <div className="plan-strip-heading">
        <span className="plan-status-dot" />
        <strong>{plan.name}</strong>
        <span>{capped ? "This month’s practice" : "Unlimited practice"}</span>
      </div>
      <div className="plan-strip-meters">
        {meters.map((m) => (
          <span
            key={m.label}
            title={
              m.limit === null
                ? `${m.used} ${m.label.toLowerCase()} sessions this month, unlimited access`
                : `${m.used} of ${m.limit} sessions used this month`
            }
          >
            <span>{m.label}</span>
            <strong
              className={
                m.limit !== null && m.used >= m.limit ? "text-hard" : ""
              }
            >
              {m.used}
              <span className="plan-denominator">
                {" "}
                /{" "}
                {m.limit === null ? (
                  <InfinityIcon size={13} aria-label="unlimited" />
                ) : (
                  m.limit
                )}
              </span>
            </strong>
          </span>
        ))}
      </div>
      <Link href="/account" className="studio-text-link">
        {plan.tier === "FREE" && capped ? "Get more practice" : "Manage plan"}
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
