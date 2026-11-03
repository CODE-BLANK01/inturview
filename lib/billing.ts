export const INTERVIEW_SPRINT = {
  product: "interview_sprint",
  amountCents: 1900,
  currency: "usd",
  accessDays: 30,
} as const;

const DAY_MS = 86_400_000;

export function addAccessDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** A repeat purchase starts after existing access, so no paid day is lost. */
export function nextAccessWindow(
  currentExpiry: Date | null,
  now: Date,
  days: number = INTERVIEW_SPRINT.accessDays
): { startsAt: Date; endsAt: Date; wasExtension: boolean } {
  const wasExtension = Boolean(currentExpiry && currentExpiry > now);
  const startsAt = wasExtension ? currentExpiry! : now;
  return {
    startsAt,
    endsAt: addAccessDays(startsAt, days),
    wasExtension,
  };
}
