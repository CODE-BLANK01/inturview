// Server-side round timing. Pure; unit-tested.
//
// A round has a planned length (what the candidate was told) and a hard
// deadline after it. The interviewer is nudged to wrap up near the planned
// time; after the hard deadline answers are refused and the round is scored.

const MINUTE = 60_000;

/** Planned length plus 50%, and at least 10 extra minutes. */
export function hardDeadline(startedAt: Date, plannedMinutes: number): Date {
  const minutes = Math.max(plannedMinutes + 10, Math.ceil(plannedMinutes * 1.5));
  return new Date(startedAt.getTime() + minutes * MINUTE);
}

export interface RoundClock {
  elapsedMinutes: number;
  plannedMinutes: number;
  /** Minutes until the planned length is up; negative once past it. */
  plannedLeftMinutes: number;
  pastDeadline: boolean;
}

export function roundClock(startedAt: Date, plannedMinutes: number, deadlineAt: Date | null, now = new Date()): RoundClock {
  const elapsed = (now.getTime() - startedAt.getTime()) / MINUTE;
  const deadline = deadlineAt ?? hardDeadline(startedAt, plannedMinutes);
  return {
    elapsedMinutes: Math.max(0, Math.floor(elapsed)),
    plannedMinutes,
    plannedLeftMinutes: Math.ceil(plannedMinutes - elapsed),
    pastDeadline: now >= deadline,
  };
}

/** A note for the interviewer about time, appended to the candidate's turn. Null when there's plenty left. */
export function interviewerTimeNote(clock: RoundClock): string | null {
  if (clock.plannedLeftMinutes <= 0) return "(Time note for the interviewer: the planned time for this round is up. Don't start a new question; close the round now.)";
  if (clock.plannedLeftMinutes <= 3) return `(Time note for the interviewer: about ${clock.plannedLeftMinutes} minute${clock.plannedLeftMinutes === 1 ? "" : "s"} left. Finish the current question and wrap up.)`;
  return null;
}
