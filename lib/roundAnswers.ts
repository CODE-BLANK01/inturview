// Candidate answers within a round, stored exactly once per browser-made
// clientTurnId. A retry of the same answer gets the stored reply back instead
// of a second model call; an answer whose reply never got saved gets a fresh one.
import type { LoopMessage } from "@prisma/client";
import { prisma } from "./db";

export const CLIENT_TURN_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Stores the answer unless it's already stored. Clears the saved draft. */
export async function recordAnswer(roundRunId: string, clientTurnId: string, content: string): Promise<{ answer: LoopMessage; isNew: boolean }> {
  const existing = await prisma.loopMessage.findUnique({ where: { roundRunId_clientTurnId: { roundRunId, clientTurnId } } });
  if (existing) return { answer: existing, isNew: false };
  try {
    const [answer] = await prisma.$transaction([
      prisma.loopMessage.create({ data: { roundRunId, role: "candidate", content, clientTurnId } }),
      prisma.loopRoundRun.update({ where: { id: roundRunId }, data: { draft: null, draftSavedAt: null } }),
    ]);
    return { answer, isNew: true };
  } catch (e) {
    // The same answer arrived twice at once; use the copy that won.
    if ((e as { code?: string }).code === "P2002") {
      return { answer: await prisma.loopMessage.findUniqueOrThrow({ where: { roundRunId_clientTurnId: { roundRunId, clientTurnId } } }), isNew: false };
    }
    throw e;
  }
}

export const replyTo = (answerId: string) => prisma.loopMessage.findUnique({ where: { replyToId: answerId } });

/** Saves the interviewer's reply. If a concurrent retry saved one first, that one stands. */
export async function saveReply(roundRunId: string, answerId: string, content: string, endsRound: boolean) {
  try {
    return await prisma.loopMessage.create({ data: { roundRunId, role: "interviewer", content, replyToId: answerId, endsRound } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return prisma.loopMessage.findUniqueOrThrow({ where: { replyToId: answerId } });
    throw e;
  }
}

/** The conversation up to and including `answerId`, which is what the model replies to. */
export function historyThrough<T extends Pick<LoopMessage, "id" | "createdAt">>(messages: T[], answerId: string): T[] {
  const i = messages.findIndex((m) => m.id === answerId);
  return i === -1 ? messages : messages.slice(0, i + 1);
}
