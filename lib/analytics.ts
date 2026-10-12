/**
 * Small, server-only PostHog capture client. Never send interview text, code,
 * answers or email addresses. The full event list, with where each one fires,
 * is in docs/analytics.md — add an event there when you add it here.
 */
export type Category = "coding" | "system_design" | "behavioral" | "recruiter_screen" | "face_to_face";
/** @deprecated Older events call the interview category "mode". */
export type Mode = Category;

type SessionRef = { mode: Category; session_id: string };

export type ProductEvent =
  // Account
  | { event: "signup_completed"; properties?: Record<string, never> }
  | { event: "email_verified"; properties?: Record<string, never> }
  | { event: "onboarding_completed"; properties: { goal: string | null; plan: string } }
  | { event: "returned_within_7d"; properties: { days_since_signup: number } }
  // Practice
  | { event: "interview_started"; properties: SessionRef }
  | { event: "phase_advanced"; properties: SessionRef & { from: string; to: string } }
  | { event: "followup_asked"; properties: SessionRef }
  | { event: "session_abandoned"; properties: SessionRef }
  | { event: "debrief_completed"; properties: SessionRef & { score: number } }
  // Money
  | { event: "checkout_started"; properties: { product: "interview_sprint"; amount_cents: number } }
  | { event: "checkout_failed"; properties: { product: "interview_sprint"; reason: string } }
  | {
      event: "purchase_completed";
      properties: {
        product: "interview_sprint";
        amount_cents: number;
        currency: string;
        access_days: number;
        was_extension: boolean;
      };
    }
  // Outreach
  | { event: "contact_submitted"; properties: { topic: "support" | "employers" } }
  // Cost of each AI call or live minute; see lib/aiCost.ts
  | {
      event: "ai_usage";
      properties: {
        category: Category;
        session_id: string;
        provider: "anthropic" | "openai_realtime" | "heygen";
        model: string;
        purpose: "interview_turn" | "debrief" | "live_voice" | "avatar";
        input_tokens?: number;
        output_tokens?: number;
        cache_write_tokens?: number;
        cache_read_tokens?: number;
        minutes?: number;
        cost_usd: number;
        estimated: boolean;
      };
    }
  // Relayed from the browser through /api/analytics/track
  | { event: "page_viewed"; properties: { path: string } }
  | { event: "signup_started"; properties?: Record<string, never> }
  | { event: "debrief_viewed"; properties: SessionRef }
  | { event: "avatar_connected"; properties: { session_id: string } }
  | { event: "avatar_fallback"; properties: { session_id: string; reason: "unavailable" | "ended" } };

export type ProductEventName = ProductEvent["event"];

/** distinct_id is the database user ID, or an anonymous per-page-load ID for signed-out visitors. */
export async function captureProductEvent(distinctId: string, data: ProductEvent): Promise<boolean> {
  const token = process.env.POSTHOG_PROJECT_TOKEN;
  if (!token) return false;

  const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: token,
        distinct_id: distinctId,
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
