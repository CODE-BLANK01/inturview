// Candidate answers within a round, stored exactly once per browser-made
// clientTurnId. A retry of the same answer gets the stored reply back instead
// of a second model call; an answer whose reply never got saved gets a fresh one.
import type { LoopMessage } from "@prisma/client";
import { prisma } from "./db";
import { touchInviteForRound } from "./activity";

export const CLIENT_TURN_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Stores the answer unless it's already stored. Clears the saved draft, and
 * records `draftSeq` (the browser's clock when it sent the answer) so an
 * autosave still in flight from before can't bring the sent text back.
 */
export async function recordAnswer(
  roundRunId: string,
  clientTurnId: string,
  content: string,
  draftSeq?: number,
): Promise<{ answer: LoopMessage; isNew: boolean }> {
  const existing = await prisma.loopMessage.findUnique({ where: { roundRunId_clientTurnId: { roundRunId, clientTurnId } } });
  if (existing) return { answer: existing, isNew: false };
  try {
    const [answer] = await prisma.$transaction([
      prisma.loopMessage.create({ data: { roundRunId, role: "candidate", content, clientTurnId } }),
      prisma.loopRoundRun.update({ where: { id: roundRunId }, data: { draft: null, draftSavedAt: null, ...(draftSeq !== undefined && { draftSeq }) } }),
    ]);
    await touchInviteForRound(roundRunId);
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

/**
 * Saves the unsent answer unless a newer save (or a sent answer) already
 * happened. `seq` is the browser's clock when it made the save; only the same
 * browser compares against it, so clock skew with the server doesn't matter.
 */
export async function saveDraft(roundRunId: string, draft: string, seq: number): Promise<boolean> {
  const r = await prisma.loopRoundRun.updateMany({
    where: { id: roundRunId, status: "IN_PROGRESS", OR: [{ draftSeq: null }, { draftSeq: { lt: seq } }] },
    data: { draft: draft || null, draftSavedAt: new Date(), draftSeq: seq },
  });
  return r.count === 1;
}

/** A writer that hasn't finished in this long is assumed gone. */
export const REPLY_CLAIM_MS = 2 * 60_000;

/** Claims the right to write the reply to an answer. One writer at a time. */
export async function claimReply(answerId: string): Promise<boolean> {
  const r = await prisma.loopMessage.updateMany({
    where: { id: answerId, OR: [{ replyClaimedAt: null }, { replyClaimedAt: { lt: new Date(Date.now() - REPLY_CLAIM_MS) } }] },
    data: { replyClaimedAt: new Date() },
  });
  return r.count === 1;
}

/** The writer failed; let a retry write the reply. */
export async function releaseReply(answerId: string) {
  await prisma.loopMessage.updateMany({ where: { id: answerId }, data: { replyClaimedAt: null } });
}

/** Waits for another request's reply to land, up to `ms`. */
export async function waitForReply(answerId: string, ms = 45_000, every = 750) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const reply = await replyTo(answerId);
    if (reply) return reply;
    await new Promise((r) => setTimeout(r, every));
  }
  return null;
}

/** True when the round's last message is the interviewer closing it. */
export async function interviewerEndedRound(roundRunId: string): Promise<boolean> {
  const last = await prisma.loopMessage.findFirst({ where: { roundRunId }, orderBy: { createdAt: "desc" }, select: { role: true, endsRound: true } });
  return !!last && last.role === "interviewer" && last.endsRound;
}
