// Where a candidate is, from the invite's status and their rounds. Pure; unit-tested.
import type { Decision, InviteStatus, RoundRunStatus } from "@prisma/client";

export const STAGES = ["needs_attention", "ready", "scoring", "in_progress", "opened", "invited", "queued", "advanced", "declined", "cancelled"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  needs_attention: "Needs attention",
  ready: "Ready for review",
  scoring: "Scoring",
  in_progress: "In progress",
  opened: "Opened",
  invited: "Invited",
  queued: "Sending",
  advanced: "Advanced",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const STAGE_PILL: Record<Stage, string> = {
  needs_attention: "border-hard/40 bg-hard/10 text-hard",
  ready: "border-easy/40 bg-easy/10 text-easy",
  scoring: "border-medium/40 bg-medium/10 text-medium",
  in_progress: "border-medium/40 bg-medium/10 text-medium",
  opened: "border-border bg-bg-surface text-text-muted",
  invited: "border-border bg-bg-surface text-text-muted",
  queued: "border-border bg-bg-inset text-text-dim",
  advanced: "border-accent/40 bg-accent/10 text-accent",
  declined: "border-border bg-bg-inset text-text-muted",
  cancelled: "border-border bg-bg-inset text-text-dim",
};

export function stageOf(inviteStatus: InviteStatus, rounds: { status: RoundRunStatus }[], totalRounds: number, decision: Decision | null = null): Stage {
  if (inviteStatus === "REVOKED") return "cancelled";
  // A decision is the last word, whatever else is going on.
  if (decision) return decision === "ADVANCE" ? "advanced" : "declined";
  switch (inviteStatus) {
    case "FAILED":
      return "needs_attention"; // the email never arrived
    case "PENDING":
      return "queued";
    case "SENT":
      return "invited";
    case "OPENED":
      return "opened";
    case "COMPLETED":
      return "ready";
    case "STARTED": {
      if (rounds.some((r) => r.status === "SCORING_FAILED")) return "needs_attention";
      const submitted = rounds.filter((r) => r.status !== "IN_PROGRESS").length;
      if (totalRounds > 0 && submitted >= totalRounds) return rounds.some((r) => r.status === "SCORING") ? "scoring" : "ready";
      return "in_progress";
    }
  }
}

/** Why a candidate needs attention, in words the hiring team can act on. */
export function attentionReason(inviteStatus: InviteStatus, rounds: { status: RoundRunStatus }[]): string | null {
  if (inviteStatus === "FAILED") return "The invitation email didn't arrive. Check the address and resend.";
  if (rounds.some((r) => r.status === "SCORING_FAILED")) return "Scoring failed. Open the candidate and re-score.";
  return null;
}
