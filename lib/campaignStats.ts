import { InviteStatus } from "@prisma/client";

export type Funnel = { invited: number; sent: number; opened: number; started: number; completed: number; pending: number; failed: number; revoked: number };

/** Turns status counts into a cumulative funnel: someone who finished also opened. Pure. */
export function funnelFrom(counts: Partial<Record<InviteStatus, number>>): Funnel {
  const n = (s: InviteStatus) => counts[s] ?? 0;
  const completed = n("COMPLETED");
  const started = completed + n("STARTED");
  const opened = started + n("OPENED");
  const sent = opened + n("SENT");
  return {
    invited: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
    sent,
    opened,
    started,
    completed,
    pending: n("PENDING"),
    failed: n("FAILED"),
    revoked: n("REVOKED"),
  };
}
