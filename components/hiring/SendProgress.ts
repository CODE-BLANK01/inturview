/** Calls the send endpoint until every queued invite is out. Returns the totals. */
export async function sendAll(
  api: string,
  campaignId: string,
  opts: { retryFailed?: boolean; onProgress?: (p: { sent: number; failed: number; remaining: number }) => void } = {},
) {
  let sent = 0;
  let failed = 0;
  for (let guard = 0; guard < 40; guard++) {
    const res = await fetch(`${api}/campaigns/${campaignId}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retryFailed: opts.retryFailed ?? false }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Sending failed (${res.status})`);
    sent += body.sent;
    failed += body.failed;
    opts.onProgress?.({ sent, failed, remaining: body.remaining });
    // Stop when the queue is empty, or when a batch made no progress (every
    // address in it failed), so a broken list can't loop forever.
    if (body.remaining === 0 || body.sent + body.failed === 0 || (opts.retryFailed && body.sent === 0)) break;
  }
  return { sent, failed };
}
