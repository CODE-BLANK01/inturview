// "Last activity" for the hiring team: bumped on anything that changes what
// they'd want to look at (sent, opened, an answer, a finished round, a note).
import { prisma } from "./db";

export function touchInvite(inviteId: string, at = new Date()) {
  return prisma.invite.updateMany({ where: { id: inviteId }, data: { lastActivityAt: at } });
}

export function touchInviteForRound(roundRunId: string, at = new Date()) {
  return prisma.invite.updateMany({ where: { run: { rounds: { some: { id: roundRunId } } } }, data: { lastActivityAt: at } });
}
