// A small durable job queue in Postgres. Same rules as lib/delivery.ts:
// claim with FOR UPDATE SKIP LOCKED and a lease, finish only while holding the
// claim, back off on failure, and give up after maxAttempts.
import { randomUUID } from "crypto";
import { JobState, Prisma } from "@prisma/client";
import { prisma } from "./db";

export const JOB_LEASE_MS = 5 * 60_000;
const BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];

export interface JobHandler {
  run(payload: unknown): Promise<void>;
  /** Called once when the last attempt fails. */
  onGiveUp?(payload: unknown, error: string): Promise<void>;
}

/** Queues a job unless one with the same key is already queued or running. Returns whether it was added. */
export async function enqueueJob(kind: string, key: string, payload: Prisma.InputJsonValue, opts: { maxAttempts?: number } = {}) {
  // runAfter from the app clock: the column default is rounded to the millisecond
  // and can land just after an immediate claim's "now", making the job look not yet due.
  const r = await prisma.job.createMany({ data: [{ kind, key, payload, maxAttempts: opts.maxAttempts ?? 5, runAfter: new Date() }], skipDuplicates: true });
  return r.count === 1;
}

interface Claimed {
  id: string;
  kind: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

async function claim(claimId: string, limit: number, key: string | null): Promise<Claimed[]> {
  // UTC strings cast to timestamp: the columns have no zone (see lib/delivery.ts).
  const at = new Date();
  const now = at.toISOString();
  const leaseCutoff = new Date(at.getTime() - JOB_LEASE_MS).toISOString();
  return prisma.$queryRaw<Claimed[]>`
    UPDATE "Job" j
    SET "state" = 'RUNNING', "claimId" = ${claimId}, "claimedAt" = ${now}::timestamp, "attempts" = j."attempts" + 1, "updatedAt" = ${now}::timestamp
    WHERE j."id" IN (
      SELECT j2."id" FROM "Job" j2
      WHERE ((j2."state" = 'QUEUED' AND j2."runAfter" <= ${now}::timestamp) OR (j2."state" = 'RUNNING' AND j2."claimedAt" < ${leaseCutoff}::timestamp))
        AND (${key}::text IS NULL OR j2."key" = ${key})
      ORDER BY j2."runAfter"
      LIMIT ${limit}
      FOR UPDATE OF j2 SKIP LOCKED
    )
    RETURNING j."id", j."kind", j."payload", j."attempts", j."maxAttempts"`;
}

/** Runs up to `limit` due jobs. `key` limits it to one job (the inline attempt after enqueue). */
export async function processJobs(handlers: Record<string, JobHandler>, opts: { limit?: number; key?: string } = {}) {
  const claimId = randomUUID();
  const jobs = await claim(claimId, opts.limit ?? 10, opts.key ?? null);
  const totals = { done: 0, retrying: 0, failed: 0 };
  for (const job of jobs) {
    const handler = handlers[job.kind];
    try {
      if (!handler) throw new Error(`No handler for job kind "${job.kind}"`);
      await handler.run(job.payload);
      const r = await prisma.job.updateMany({ where: { id: job.id, state: JobState.RUNNING, claimId }, data: { state: JobState.DONE, lastError: null } });
      if (r.count) totals.done++;
    } catch (e) {
      const error = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
      const final = job.attempts >= job.maxAttempts;
      const r = await prisma.job.updateMany({
        where: { id: job.id, state: JobState.RUNNING, claimId },
        data: final
          ? { state: JobState.FAILED, lastError: error }
          : { state: JobState.QUEUED, lastError: error, claimId: null, runAfter: new Date(Date.now() + BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]!) },
      });
      if (!r.count) continue;
      if (final) {
        totals.failed++;
        await handler?.onGiveUp?.(job.payload, error).catch((err) => console.error("[jobs] onGiveUp failed:", err));
      } else totals.retrying++;
    }
  }
  return totals;
}
