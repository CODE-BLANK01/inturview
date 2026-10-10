import { z } from "zod";

export const LoopModeSchema = z.enum([
  "recruiter",
  "behavioral",
  "coding",
  "design",
]);
export type LoopMode = z.infer<typeof LoopModeSchema>;
export const LOOP_MODE_LABELS: Record<LoopMode, string> = {
  recruiter: "Recruiter screen",
  behavioral: "Behavioral",
  coding: "Coding",
  design: "System design",
};
export interface LoopQuota {
  used: number;
  cap: number | null;
}
export type LoopQuotas = Record<LoopMode, LoopQuota>;
export const LoopInputSchema = z.object({
  jobPost: z
    .string()
    .trim()
    .min(40, "Paste a job post with at least 40 characters.")
    .max(20000),
  resume: z
    .string()
    .trim()
    .min(40, "Add at least 40 characters about your experience.")
    .max(20000),
  interviewDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your interview date.")
    .refine(
      (value) =>
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value,
      "Choose a valid date.",
    ),
});
export type LoopInput = z.infer<typeof LoopInputSchema>;
export const LoopRoundSchema = z.object({
  id: z.string(),
  mode: LoopModeSchema,
  title: z.string(),
  focus: z.string(),
  status: z.enum(["locked", "available", "in_progress", "complete"]),
  answer: z.string().optional(),
});
export type LoopRound = z.infer<typeof LoopRoundSchema>;
export const LoopSchema = z.object({
  id: z.string(),
  role: z.string(),
  interviewDate: z.string(),
  rounds: z.array(LoopRoundSchema).min(1),
  notes: z.array(
    z.object({ roundId: z.string(), round: z.string(), quote: z.string() }),
  ),
  createdAt: z.string(),
});
export type InterviewLoop = z.infer<typeof LoopSchema>;

/** UI contract only. No implied API, database model, or production AI integration. */
export interface LoopRepository {
  readonly kind: "mock";
  generate(input: LoopInput, signal: AbortSignal): AsyncIterable<LoopRound>;
  create(input: LoopInput, rounds: LoopRound[]): Promise<InterviewLoop>;
  get(id: string): Promise<InterviewLoop | null>;
  save(loop: InterviewLoop): Promise<void>;
}

export function quotaMessage(
  mode: LoopMode,
  quotas: LoopQuotas,
): string | null {
  const { used, cap } = quotas[mode];
  return cap !== null && used >= cap
    ? `You have used ${used} of ${cap} ${LOOP_MODE_LABELS[mode].toLowerCase()} sessions this month. Wait for the monthly reset or get Interview Sprint to continue.`
    : null;
}

export function beginLoopRound(
  loop: InterviewLoop,
  roundId: string,
): InterviewLoop {
  const round = loop.rounds.find((item) => item.id === roundId);
  if (!round || !["available", "in_progress"].includes(round.status))
    throw new Error("Complete the previous round first.");
  return {
    ...loop,
    rounds: loop.rounds.map((item) =>
      item.id === roundId ? { ...item, status: "in_progress" } : item,
    ),
  };
}

export function completeLoopRound(
  loop: InterviewLoop,
  roundId: string,
  answer: string,
): InterviewLoop {
  const index = loop.rounds.findIndex((item) => item.id === roundId);
  if (
    index < 0 ||
    loop.rounds[index]?.status !== "in_progress" ||
    !answer.trim()
  )
    throw new Error("Add an answer to the current round first.");
  const round = loop.rounds[index]!;
  return {
    ...loop,
    rounds: loop.rounds.map((item, i) =>
      i === index
        ? { ...item, status: "complete", answer: answer.trim() }
        : i === index + 1
          ? { ...item, status: "available" }
          : item,
    ),
    notes: [
      ...loop.notes.filter((note) => note.roundId !== roundId),
      { roundId, round: LOOP_MODE_LABELS[round.mode], quote: answer.trim() },
    ],
  };
}

/** Narrow, explicit demo rule. Never represents a full AI consistency evaluation. */
export function consistencyFindings(loop: InterviewLoop) {
  const solo = loop.notes.find((note) =>
    /\b(alone|by myself|sole owner)\b/i.test(note.quote),
  );
  const team = loop.notes.find(
    (note) =>
      note.roundId !== solo?.roundId &&
      /\b(our team|we built|shared ownership)\b/i.test(note.quote),
  );
  return solo && team
    ? [
        {
          title: "Make your ownership precise.",
          left: solo,
          right: team,
          coaching:
            "These answers use different language about ownership. They may describe different projects. Add that context, then distinguish your contribution from the team’s work.",
        },
      ]
    : [];
}
