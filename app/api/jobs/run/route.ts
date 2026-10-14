import { timingSafeEqual } from "crypto";
import { processDeliveries } from "@/lib/delivery";

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
  const totals = { sent: 0, failed: 0, retrying: 0, batches: 0 };
  while (Date.now() - started < BUDGET_MS) {
    const r = await processDeliveries({ limit: 50 });
    totals.sent += r.sent;
    totals.failed += r.failed;
    totals.retrying += r.retrying;
    if (r.sent + r.failed + r.retrying === 0) break;
    totals.batches++;
  }
  return Response.json(totals);
}
