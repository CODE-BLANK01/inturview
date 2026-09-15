/** Small, server-only PostHog capture client. Never send interview text or email. */
type Mode = "coding" | "system_design" | "behavioral" | "recruiter_screen";

export type ProductEvent =
  | { event: "signup"; properties?: Record<string, never> }
  | { event: "interview_started"; properties: { mode: Mode; session_id: string } }
  | { event: "phase_advanced"; properties: { mode: Mode; session_id: string; from: string; to: string } }
  | { event: "debrief_completed"; properties: { mode: Mode; session_id: string; score: number } }
  | { event: "returned_within_7d"; properties: { days_since_signup: number } };

export async function captureProductEvent(userId: string, data: ProductEvent): Promise<boolean> {
  const token = process.env.POSTHOG_PROJECT_TOKEN;
  if (!token) return false;

  const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: token,
        distinct_id: userId,
        event: data.event,
        properties: { $process_person_profile: false, ...data.properties },
      }),
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.error("[analytics] capture failed:", data.event, error instanceof Error ? error.message : error);
    return false;
  }
}
