# Analytics

Every event goes to PostHog server-side through `captureProductEvent` in
`lib/analytics.ts`. The `ProductEvent` type there is the source of truth: an
event that isn't in it won't compile. Add a row here when you add one there.

Nothing is sent when `POSTHOG_PROJECT_TOKEN` is unset (local dev, CI).

## Rules

- **Never send** interview transcripts, answers, code, canvas content, or email
  addresses. The database user ID is the only identifier.
- **Signed-out visitors** get a random ID per page load (`anon_…`). No cookies,
  no local storage, so no consent banner is needed.
- **Person profiles are off** (`$process_person_profile: false`). Funnels and
  counts work; per-person properties don't.
- **The browser can only send** the five events allowlisted in
  `app/api/analytics/track/route.ts`. Everything that involves money, sessions
  or accounts is decided and sent by the server.

## Events

`mode` is the interview category: `coding`, `system_design`, `behavioral`,
`recruiter_screen`, `face_to_face`. (`ai_usage` calls the same thing `category`.)

### Account

| Event | Fires when | Properties | Where |
|---|---|---|---|
| `signup_started` | Signup form submitted | — | `components/AuthForm.tsx` (browser) |
| `signup_completed` | Account created | — | `app/api/auth/signup` |
| `email_verified` | Verification link accepted | — | `app/verify-email/page.tsx` |
| `onboarding_completed` | Onboarding finished | `goal`, `plan` | `app/api/onboarding/complete` |
| `returned_within_7d` | First dashboard visit 24h–7d after signup | `days_since_signup` | `app/dashboard/page.tsx` |

### Practice

| Event | Fires when | Properties | Where |
|---|---|---|---|
| `interview_started` | A new round starts (not a resume) | `mode`, `session_id` | each `*/start` route |
| `phase_advanced` | Candidate moves approach→code, scope→design, or into the debrief | `mode`, `session_id`, `from`, `to` | `app/api/analytics/phase`, debrief routes |
| `followup_asked` | A follow-up question about a debrief is answered | `mode`, `session_id` | `*/message` routes |
| `session_abandoned` | Candidate ends a round early | `mode`, `session_id` | `*/abandon` routes |
| `debrief_completed` | Scorecard saved | `mode`, `session_id`, `score` | `*/debrief` routes |
| `debrief_viewed` | A finished debrief is opened from history | `mode`, `session_id` | history detail pages (browser) |
| `avatar_connected` | The live avatar face starts | `session_id` | `FaceToFaceSession` (browser) |
| `avatar_fallback` | The avatar fails to start or drops mid-round; the round continues voice-only | `session_id`, `reason` | `FaceToFaceSession` (browser) |

### Money

| Event | Fires when | Properties | Where |
|---|---|---|---|
| `checkout_started` | Stripe Checkout session created | `product`, `amount_cents` | `app/api/billing/checkout` |
| `checkout_failed` | Creating the Checkout session failed | `product`, `reason` (error class only) | `app/api/billing/checkout` |
| `purchase_completed` | Stripe webhook confirms payment | `product`, `amount_cents`, `currency`, `access_days`, `was_extension` | `app/api/billing/webhook` |

### Outreach and traffic

| Event | Fires when | Properties | Where |
|---|---|---|---|
| `page_viewed` | A public page is shown | `path` (query string stripped) | `MarketingLayout` (browser) |
| `contact_submitted` | Contact form delivered | `topic`: `support` or `employers` | `app/api/contact` |

Pricing-page visits are `page_viewed` with `path = '/pricing'`.

### Cost

| Event | Fires when | Properties | Where |
|---|---|---|---|
| `ai_usage` | Every Claude reply and debrief; live minutes when a face-to-face round is scored | `category`, `session_id`, `provider`, `model`, `purpose`, token counts or `minutes`, `cost_usd`, `estimated` | `lib/aiCost.ts` |

- Claude cost uses list prices in `lib/aiCost.ts` (checked 2026-10-10). A model
  without a price row reports `cost_usd: 0, estimated: true`. Add the row when
  switching models.
- Live voice and avatar minutes use `COST_REALTIME_VOICE_PER_MIN` and
  `COST_AVATAR_PER_MIN`, and are always `estimated: true`. Avatar minutes assume
  the face ran the whole round; compare with `avatar_fallback` to see how often
  that overstates it. Update the rates from real invoices.

## Dashboards to build in PostHog

1. **Activation funnel:** `page_viewed` → `signup_completed` → `email_verified`
   → `interview_started` → `debrief_completed` → `purchase_completed`.
2. **Starts and completion by category:** `interview_started` and
   `debrief_completed`, broken down by `mode`.
3. **Drop-off inside a round:** `interview_started` → `phase_advanced` →
   `debrief_completed`, plus `session_abandoned` by `mode`.
4. **Cost per finished round** (SQL insight):
   ```sql
   SELECT coalesce(properties.category, properties.mode) AS category,
          sumIf(toFloat(properties.cost_usd), event = 'ai_usage')
            / nullIf(countIf(event = 'debrief_completed'), 0) AS usd_per_round
     FROM events
    WHERE timestamp > now() - INTERVAL 30 DAY
      AND event IN ('ai_usage', 'debrief_completed')
    GROUP BY category
   ```
5. **Avatar reliability:** `avatar_connected` vs `avatar_fallback` by `reason`.

The Monday digest (`scripts/digest.ts`) posts the headline numbers from these
to Discord.
