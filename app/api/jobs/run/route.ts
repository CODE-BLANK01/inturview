import { timingSafeEqual } from "crypto";
import { processDeliveries } from "@/lib/delivery";
import { processJobs } from "@/lib/jobs";
import { finishOverdueRounds, recoverOrphanedScoring, scoringHandlers } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 26;

/** Leave headroom under the function time limit. */
const BUDGET_MS = 20_000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/**
 * Drains background work. Called every minute by netlify/functions/run-jobs.mts;
 * safe to call more often or from several places at once.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  const emails = { sent: 0, failed: 0, retrying: 0 };
  const jobs = { done: 0, failed: 0, retrying: 0 };
  const handlers = scoringHandlers();
  const roundsClosed = await finishOverdueRounds();
  const scoringRecovered = await recoverOrphanedScoring();
  while (Date.now() - started < BUDGET_MS) {
    const d = await processDeliveries({ limit: 50 });
    const j = await processJobs(handlers, { limit: 5 });
    for (const k of Object.keys(emails) as (keyof typeof emails)[]) emails[k] += d[k];
    for (const k of Object.keys(jobs) as (keyof typeof jobs)[]) jobs[k] += j[k];
    if (d.sent + d.failed + d.retrying + j.done + j.failed + j.retrying === 0) break;
  }
  return Response.json({ emails, jobs, roundsClosed, scoringRecovered });
}
