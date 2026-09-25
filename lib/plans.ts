import { PlanTier } from "@prisma/client";

export interface PlanDefinition {
  tier: PlanTier;
  /** Customer-facing name (e.g. "Free", "Pro"). */
  name: string;
  /** One-line positioning copy used on the plan-select card. */
  tagline: string;
  /** Cents per billing period, or null for custom / not-priced-yet. */
  priceCents: number | null;
  billingPeriod: "month" | "30_days" | null;
  /** Audience: who is this plan for? */
  audience: "candidate" | "employer";
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
    tagline: "Learn each interview format and find the gaps to work on.",
    priceCents: 0,
    billingPeriod: null,
    audience: "candidate",
    features: [
      "{{recruiterSessions}} recruiter screens per month",
      "{{behavioralSessions}} behavioral sessions per month",
      "{{interviews}} coding interviews per month",
      "{{designSessions}} system-design sessions per month",
      "Full debriefs and interview history",
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
    name: "Interview Sprint",
    tagline: "Thirty focused days of practice before the real interview.",
    priceCents: 1900,
    billingPeriod: "30_days",
    audience: "candidate",
    features: [
      "Unlimited recruiter, behavioral, coding, and design practice",
      "Full debriefs and interview history",
      "Repeat weak rounds without monthly caps",
      "One payment with no annual commitment",
    ],
    interviewsPerMonth: null,
    designSessionsPerMonth: null,
    behavioralSessionsPerMonth: null,
    recruiterSessionsPerMonth: null,
    faceToFaceSessionsPerMonth: 30,
    selectable: false,
    availabilityNote: "Opening soon",
  },
  {
    tier: PlanTier.TEAM_STARTER,
    name: "Employer Pilot",
    tagline: "Validate one role with real candidates and a calibrated shortlist.",
    priceCents: 0,
    billingPeriod: null,
    audience: "employer",
    features: [
      "First 10 completed employer-invited screens",
      "One active role and a structured interview",
      "Evidence-backed scorecards and ranked shortlist",
      "Founder-led setup and calibration",
    ],
    interviewsPerMonth: 0,
    designSessionsPerMonth: 0,
    behavioralSessionsPerMonth: 0,
    recruiterSessionsPerMonth: 0,
    faceToFaceSessionsPerMonth: 0,
    selectable: false,
    availabilityNote: "Design partners",
  },
  {
    tier: PlanTier.TEAM_GROWTH,
    name: "Employer Screening",
    tagline: "Pay for completed AI screens, then move the strongest candidates forward.",
    priceCents: null,
    billingPeriod: null,
    audience: "employer",
    features: [
      "$10 per completed employer-invited screen",
      "Role-specific questions and evaluation rubric",
      "Evidence-backed scorecards and ranked shortlist",
      "No recruiter-seat pricing",
    ],
    interviewsPerMonth: 0,
    designSessionsPerMonth: 0,
    behavioralSessionsPerMonth: 0,
    recruiterSessionsPerMonth: 0,
    faceToFaceSessionsPerMonth: 0,
    selectable: false,
    availabilityNote: "After pilot",
  },
  {
    tier: PlanTier.ENTERPRISE,
    name: "Employer Volume",
    tagline: "Volume screening, integrations, controls, and procurement support.",
    priceCents: null,
    billingPeriod: null,
    audience: "employer",
    features: [
      "Custom evaluation systems",
      "Workflow integrations (ATS, Slack)",
      "API access + white-label",
      "SSO, audit log export, SLA",
    ],
    interviewsPerMonth: 0,
    designSessionsPerMonth: 0,
    behavioralSessionsPerMonth: 0,
    recruiterSessionsPerMonth: 0,
    faceToFaceSessionsPerMonth: 0,
    selectable: false,
    availabilityNote: "Talk to us",
  },
];

export const CANDIDATE_PLANS = PLANS.filter((plan) => plan.audience === "candidate");

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
    faceToFaceSessionsPerMonth: null,
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

/** Format the price for display; cadence is rendered separately. */
export function priceLabel(plan: PlanDefinition): string {
  if (plan.priceCents === null) return "Custom";
  if (plan.priceCents === 0) return "$0";
  return `$${(plan.priceCents / 100).toFixed(0)}`;
}

export function priceSuffix(plan: PlanDefinition): string {
  if (plan.priceCents === null || plan.priceCents === 0) return "";
  return plan.billingPeriod === "30_days" ? " / 30 days" : " / month";
}

/** Start of the current calendar month, UTC. Used to scope monthly caps. */
export function startOfMonthUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
