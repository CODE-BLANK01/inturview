/**
 * Browser-side analytics. Sends allowlisted events to /api/analytics/track;
 * no cookies, no storage. Signed-out visitors get a random ID that lives only
 * as long as this page load.
 */
type ClientEvent =
  | { event: "page_viewed"; properties: { path: string } }
  | { event: "signup_started" }
  | { event: "debrief_viewed"; properties: { mode: string; session_id: string } }
  | { event: "avatar_connected"; properties: { session_id: string } }
  | { event: "avatar_fallback"; properties: { session_id: string; reason: "unavailable" | "ended" } };

let anonymousId: string | undefined;

export function track(data: ClientEvent): void {
  if (typeof window === "undefined") return;
  anonymousId ??= `anon_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ anonymous_id: anonymousId, data }),
    keepalive: true,
  }).catch(() => {
    /* Analytics must never interrupt the page. */
  });
}
