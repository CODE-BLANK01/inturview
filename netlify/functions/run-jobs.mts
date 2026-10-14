// Netlify Scheduled Function: every minute, ask the app to drain its queues
// (invite emails today; scoring retries next). Runs on published deploys only.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[run-jobs] URL or CRON_SECRET missing; skipping");
    return new Response(null, { status: 500 });
  }
  const res = await fetch(`${base}/api/jobs/run`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  if (!res.ok) console.error("[run-jobs] worker returned", res.status);
  return new Response(null, { status: res.ok ? 204 : 502 });
};

export const config = { schedule: "* * * * *" };
