import { PlanTier } from "@prisma/client";

export interface PlanDefinition {
  tier: PlanTier;
  /** Customer-facing name (e.g. "Free", "Pro"). */
  name: string;
  /** One-line positioning copy used on the plan-select card. */
  tagline: string;
  /** Cents per month, or null for custom / not-priced-yet. */
  priceMonthlyCents: number | null;
  /** Audience: who is this plan for? */
  audience: "individual" | "team" | "enterprise";
  /** Bullet features shown on the card. Keep tight — 3–5 lines max. */
  features: string[];
  /** Hard cap on completed-or-in-progress interviews per calendar month.
   *  null = unlimited. */
  interviewsPerMonth: number | null;
  /** Whether a user can select this plan from the onboarding wizard today. */
  selectable: boolean;
  /** When selectable=false, this is the "Coming Q2" style note. */
  availabilityNote?: string;
}

/** Free-tier monthly interview cap. Configurable via env so support can bump
 *  individual users by setting a per-account override later. */
function freeInterviewsPerMonth(): number {
  const v = Number(process.env.FREE_INTERVIEWS_PER_MONTH ?? "5");
  return Number.isFinite(v) && v >= 0 ? v : 5;
}

export const PLANS: PlanDefinition[] = [
  {
    tier: PlanTier.FREE,
    name: "Free",
    tagline: "Run a few real mocks. See what the scorecard actually looks like.",
    priceMonthlyCents: 0,
    audience: "individual",
    features: [
      "Up to {{interviews}} mock interviews per month",
      "Full three-phase loop — approach, code, debrief",
      "Five-dimension rubric scorecard",
      "All NeetCode 150 problems unlocked",
    ],
    interviewsPerMonth: freeInterviewsPerMonth(),
    selectable: true,
  },
  {
    tier: PlanTier.PRO,
    name: "Pro",
    tagline: "Unlimited practice. Company modes. Coding rounds.",
    priceMonthlyCents: 1900,
    audience: "individual",
    features: [
      "Unlimited mock interviews",
      "Company-specific interview modes",
      "Advanced AI feedback + benchmarking",
      "Priority response speed",
    ],
    interviewsPerMonth: null,
    selectable: false,
    availabilityNote: "Coming soon",
  },
  {
    tier: PlanTier.TEAM_STARTER,
    name: "Team — Starter",
    tagline: "For small recruiting teams running structured screens.",
    priceMonthlyCents: 9900,
    audience: "team",
    features: [
      "~20 candidate interview sessions / month",
      "Recruiter dashboard + scorecards",
      "Custom rubric configuration",
      "Up to 3 seats",
    ],
    interviewsPerMonth: 20,
    selectable: false,
    availabilityNote: "Coming soon",
  },
  {
    tier: PlanTier.TEAM_GROWTH,
    name: "Team — Growth",
    tagline: "When you're hiring across multiple roles and need analytics.",
    priceMonthlyCents: 29900,
    audience: "team",
    features: [
      "~100 candidate interview sessions / month",
      "Candidate comparison + analytics",
      "Calibrated scoring & benchmarking",
      "Up to 10 seats, shared workspaces",
    ],
    interviewsPerMonth: 100,
    selectable: false,
    availabilityNote: "Coming soon",
  },
  {
    tier: PlanTier.ENTERPRISE,
    name: "Enterprise",
    tagline: "Custom workflows, API access, white-label.",
    priceMonthlyCents: null,
    audience: "enterprise",
    features: [
      "Custom evaluation systems",
      "Workflow integrations (ATS, Slack)",
      "API access + white-label",
      "SSO, audit log export, SLA",
    ],
    interviewsPerMonth: null,
    selectable: false,
    availabilityNote: "Talk to us",
  },
];

export function getPlan(tier: PlanTier): PlanDefinition {
  const p = PLANS.find((x) => x.tier === tier);
  if (!p) throw new Error(`Unknown plan tier: ${tier}`);
  return p;
}

/** Substitutes template tokens like {{interviews}} in feature strings. */
export function renderFeature(text: string, plan: PlanDefinition): string {
  const cap = plan.interviewsPerMonth;
  return text.replace(
    /\{\{interviews\}\}/g,
    cap === null ? "unlimited" : cap.toString()
  );
}

/** Format the monthly price for display. */
export function priceLabel(plan: PlanDefinition): string {
  if (plan.priceMonthlyCents === null) return "Custom";
  if (plan.priceMonthlyCents === 0) return "$0";
  return `$${(plan.priceMonthlyCents / 100).toFixed(0)}`;
}

/** Start of the current calendar month, UTC. Used to scope monthly caps. */
export function startOfMonthUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
