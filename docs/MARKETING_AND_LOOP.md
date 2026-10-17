# Public pages and The Loop prototype

The five public pages compose `components/marketing`: `MarketingLayout` owns
navigation, the main landmark, and footer; `Section` owns width, gutters, tone,
and spacing. `SectionHeading` uses the single fluid display scale in
`app/globals.css`. Page-specific composition lives in `app/marketing.css`.

- Keep one Instrument Serif ember phrase inside each public H1.
- Use token colors and semantic classes; do not add arbitrary Tailwind sizes.
- Candidate actions lead to signup or the existing Stripe checkout flow.
- Employer actions lead to `/contact?topic=employers`, never candidate checkout.
- `Reveal` progressively enhances visible HTML with one 400ms entrance.
  Reduced motion bypasses opacity and transform animation, including when the
  preference changes during a visit. No-JavaScript content remains visible.

`Brand` pairs the supplied, unmodified `public/inturview-symbol.png` with the
original `public/logo.svg` wordmark artwork, including its frame and lettering;
never replace it with typeset text. Public and top navigation use the wordmark
alone, as does the footer. Product examples do not repeat the logo. The favicon
uses the circular symbol.
The home hero's `PracticePreview` walks through question, follow-up, and takeaway
examples for all four practice modes. It uses explicit sample copy and local
state, with no AI calls, session writes, or automatically cycling content.

## Contact delivery

`/api/contact` validates the shared `lib/contact.ts` schema, checks request origin,
and applies the existing per-instance IP rate limiter (five messages per hour).
Messages are delivered to `hello@inturview.com` with the sender's validated
address in Reply-To. Design-partner links preselect the employer topic and send
with the subject `Inturview Hire — design partner enquiry`; general messages use
`Inturview — contact enquiry`. Direct email links keep the same topic in their
subject. The shared destination and subjects live in `lib/contact.ts`.
Set `RESEND_API_KEY` and a verified `RESEND_FROM` in both local and production
environments; missing
configuration returns an honest unavailable state, never a logged-email success.
The form retains the draft on network/provider errors and stays in place after
successful submission. Browser tests should intercept delivery; do not send
test messages to the real mailbox.

## The Loop: intentionally a prototype

Set `NEXT_PUBLIC_LOOP_PREVIEW_ENABLED=true` locally and restart Next.js. The
default is false; disabled routes render the not-found page. Routes require a signed-in,
verified, onboarded candidate:

- `/loop/new`: paste role and experience, pick a date, progressively display a
  template plan, reorder/remove rounds, and confirm.
- `/loop/[id]`: next action, countdown, sequentially unlocked rounds, and shared
  running notes. Questions carry forward the prior round's quoted answer.
- `/loop/[id]/debrief`: a clearly labeled fixed sample scorecard and a narrow
  ownership-language comparison using actual draft quotes from different rounds.

`lib/loop.ts` defines the typed repository contract, state transitions, validation,
and quota explanations. `lib/loopMock.ts` is the only implementation. It makes no
AI/API requests. Résumé and job-post bodies are not persisted; the short role
label, date, rounds, and saved answer notes use user-scoped sessionStorage and
remain only in the current browser tab. They are not stored in Prisma, shared
across devices, counted toward paid usage, or sent to analytics.

Actual plan limits are read from `lib/plans.ts` and current session counts. When a
round is gated, the UI explains the limit and links to account/plan management.
There is no Loop billing product, endpoint contract, or claim of real AI grading.
Replace the mock repository deliberately when backend work is approved.

Verification covers typecheck, the production build, state/validation unit tests,
400px and desktop layouts in both themes, keyboard navigation, contact/checkout
states with intercepted network responses, and reduced-motion accessibility.
