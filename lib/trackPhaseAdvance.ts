/** Called only from explicit user phase transitions, never from session restore. */
export function trackPhaseAdvance(mode: "coding" | "system_design", sessionId: string): void {
  fetch("/api/analytics/phase", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, session_id: sessionId, to: mode === "coding" ? "code" : "design" }),
    keepalive: true,
  }).catch(() => { /* Analytics must never interrupt practice. */ });
}
