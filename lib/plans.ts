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
  /** Hard cap on coding-interview starts per calendar month. null = unlimited. */
  interviewsPerMonth: number | null;
  /** Hard cap on system-design-session starts per calendar month. null = unlimited.
   *  Separate counter from coding interviews — design sessions are ~2-3x more
   *  expensive per AI call (bigger context, longer duration). */
  designSessionsPerMonth: number | null;
  /** Hard cap on behavioral-session starts per calendar month. null = unlimited. */
  behavioralSessionsPerMonth: number | null;
  /** Hard cap on recruiter-screen starts per calendar month. null = unlimited. */
  recruiterSessionsPerMonth: number | null;
  /** Hard cap on face-to-face (live voice) starts per calendar month. null = unlimited.
   *  Realtime audio tokens cost an order of magnitude more than text, so this
   *  is the tightest cap. */
  faceToFaceSessionsPerMonth: number | null;
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

function freeDesignSessionsPerMonth(): number {
  const v = Number(process.env.FREE_DESIGN_SESSIONS_PER_MONTH ?? "2");
  return Number.isFinite(v) && v >= 0 ? v : 2;
}

function freeBehavioralSessionsPerMonth(): number {
  const v = Number(process.env.FREE_BEHAVIORAL_SESSIONS_PER_MONTH ?? "3");
  return Number.isFinite(v) && v >= 0 ? v : 3;
}

function freeRecruiterSessionsPerMonth(): number {
  const v = Number(process.env.FREE_RECRUITER_SESSIONS_PER_MONTH ?? "2");
  return Number.isFinite(v) && v >= 0 ? v : 2;
}

function freeFaceToFaceSessionsPerMonth(): number {
  const v = Number(process.env.FREE_FACE_TO_FACE_SESSIONS_PER_MONTH ?? "2");
  return Number.isFinite(v) && v >= 0 ? v : 2;
}

const UNLIMITED_PLAN_EMAILS = new Set(
  [
    "abdullahbasarvi@gmail.com",
    ...(process.env.UNLIMITED_PLAN_EMAILS ?? "").split(","),
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export const PLANS: PlanDefinition[] = [
  {
    tier: PlanTier.FREE,
    name: "Free",
    tagline: "Practice the first screen, then the rounds that follow.",
    priceMonthlyCents: 0,
    audience: "individual",
    features: [
      "{{recruiterSessions}} recruiter screens per month",
      "{{behavioralSessions}} behavioral sessions per month",
      "{{interviews}} coding interviews per month",
      "{{designSessions}} system-design sessions per month",
      "Five-dimension debriefs across every mode",
    ],
    interviewsPerMonth: freeInterviewsPerMonth(),
    designSessionsPerMonth: freeDesignSessionsPerMonth(),
    behavioralSessionsPerMonth: freeBehavioralSessionsPerMonth(),
    recruiterSessionsPerMonth: freeRecruiterSessionsPerMonth(),
    faceToFaceSessionsPerMonth: freeFaceToFaceSessionsPerMonth(),
    selectable: true,
  },
  {
    tier: PlanTier.PRO,
    name: "Pro",
    tagline: "Unlimited practice across every interview mode.",
    priceMonthlyCents: 1900,
    audience: "individual",
    features: [
      "Unlimited recruiter, behavioral, coding, and design practice",
      "Company-specific interview modes",
      "Advanced AI feedback + benchmarking",
      "Priority response speed",
    ],
    interviewsPerMonth: null,
    designSessionsPerMonth: null,
    behavioralSessionsPerMonth: null,
    recruiterSessionsPerMonth: null,
    faceToFaceSessionsPerMonth: 30,
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
      "~8 system-design sessions / month",
      "Recruiter dashboard + scorecards",
      "Custom rubric configuration",
      "Up to 3 seats",
    ],
    interviewsPerMonth: 20,
    designSessionsPerMonth: 8,
    behavioralSessionsPerMonth: 20,
    recruiterSessionsPerMonth: 10,
    faceToFaceSessionsPerMonth: 10,
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
      "~40 system-design sessions / month",
      "Candidate comparison + analytics",
      "Calibrated scoring & benchmarking",
      "Up to 10 seats, shared workspaces",
    ],
    interviewsPerMonth: 100,
    designSessionsPerMonth: 40,
    behavioralSessionsPerMonth: 100,
    recruiterSessionsPerMonth: 50,
    faceToFaceSessionsPerMonth: 50,
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
    designSessionsPerMonth: null,
    behavioralSessionsPerMonth: null,
    recruiterSessionsPerMonth: null,
    faceToFaceSessionsPerMonth: null,
    selectable: false,
    availabilityNote: "Talk to us",
  },
];

export function getPlan(tier: PlanTier): PlanDefinition {
  const p = PLANS.find((x) => x.tier === tier);
  if (!p) throw new Error(`Unknown plan tier: ${tier}`);
  return p;
}

export function hasUnlimitedPlanOverride(email: string | null | undefined): boolean {
  return UNLIMITED_PLAN_EMAILS.has((email ?? "").trim().toLowerCase());
}

export function getEffectivePlan(
  tier: PlanTier,
  email: string | null | undefined
): PlanDefinition {
  const plan = getPlan(tier);
  if (!hasUnlimitedPlanOverride(email)) return plan;
  // An access override changes limits, not the account's paid tier or price.
  return {
    ...plan,
    interviewsPerMonth: null,
    designSessionsPerMonth: null,
    behavioralSessionsPerMonth: null,
    recruiterSessionsPerMonth: null,
  };
}

/** Substitutes template tokens like {{interviews}} in feature strings. */
export function renderFeature(text: string, plan: PlanDefinition): string {
  return text
    .replace(/\{\{interviews\}\}/g, plan.interviewsPerMonth === null ? "unlimited" : String(plan.interviewsPerMonth))
    .replace(/\{\{designSessions\}\}/g, plan.designSessionsPerMonth === null ? "unlimited" : String(plan.designSessionsPerMonth))
    .replace(/\{\{behavioralSessions\}\}/g, plan.behavioralSessionsPerMonth === null ? "unlimited" : String(plan.behavioralSessionsPerMonth))
    .replace(/\{\{recruiterSessions\}\}/g, plan.recruiterSessionsPerMonth === null ? "unlimited" : String(plan.recruiterSessionsPerMonth));
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
