# Three products, one platform

Status: **proposal, awaiting sign-off.** Nothing here is implemented yet.

inturview becomes three products on one codebase, one database and one sign-in:

| Product | Who | URL | Central question |
|---|---|---|---|
| **Practice** (B2C) | A person preparing for interviews | `/dashboard`, `/practice/*`, `/history`, `/progress`, `/account` | What should I practice next, and am I improving? |
| **Hire** (B2B) | Members of a hiring company | `/hire/[org]/*` | What needs my attention in this hiring process? |
| **Admin** (internal) | inturview operators | `/admin/*` | Is the platform healthy, and what is failing? |

Plus one focused surface owned by Hire: the **applicant interview** at `/i/[token]/*`.

---

## 1. Where things are today

| Concern | Today | Problem |
|---|---|---|
| Employer workflows | `/admin/loops`, `/admin/campaigns`, `/admin/questions` | Employers would need platform `ADMIN` to hire. |
| Organizations | `Organization {id, name, slug}`, no members | Nothing can be scoped to a company. |
| Platform role | `Role = USER \| ADMIN` on `User` | Fine for operators; must not double as employer access. |
| Applicant identity | PR #6 creates a `User` per applicant | Silently creates practice accounts; links hiring data to practice identity. |
| Shells | Root layout and `/admin` layout only | Practice pages mount their own shell; no Hire shell. |
| Auth guard | Middleware covers some practice prefixes | `/behavioral`, `/recruiter-screen`, `/face-to-face` rely on page checks only. |
| Plans | `PlanTier` includes legacy `TEAM_*` tiers | Must not be presented as employer pricing. |
| Round format | Builder estimates voice + avatar; runner is text | Cost, preview and execution disagree. |

Open PRs: **#4** loop builder, **#5** invites, **#6** applicant runner. Their foundations are reused; §5 lists what changes.

---

## 2. Route map

### Practice (unchanged URLs where possible)

| Route | Notes |
|---|---|
| `/dashboard` | Overview: continue, next action, recent feedback, progress. |
| `/practice` | New index of modes. Existing mode URLs stay. |
| `/recruiter-screen`, `/behavioral[/id]`, `/problems`, `/interview/[id]`, `/design-problems`, `/design/[id]`, `/face-to-face` | Unchanged. Face-to-face stays waitlisted. |
| `/loop/*` (job-post prototype) | Stays behind `NEXT_PUBLIC_LOOP_PREVIEW_ENABLED`; renamed in UI to avoid clashing with Hire loops. |
| `/history[/...]`, `/progress` (new), `/account` | Practice-only. |
| `/onboarding` → `/onboarding/practice` | Practice onboarding only. Redirect kept. |

### Hire (new)

| Route | Purpose |
|---|---|
| `/hire` | Workspace picker, or redirect to the only workspace. |
| `/hire/new` | Company onboarding (gated, see decision D1). |
| `/hire/join/[token]` | Accept a teammate invitation. |
| `/hire/[org]` | Overview: awaiting review, active roles, failed deliveries, ready loops. |
| `/hire/[org]/roles[/id]` | Hiring roles and their candidates. |
| `/hire/[org]/loops[/id]` | Loop builder, preview, publish (moved from `/admin/loops`). |
| `/hire/[org]/loops/[id]/preview` | Preview as candidate (sandboxed, no sends, no reporting). |
| `/hire/[org]/candidates[/applicationId]` | Applications across roles; review view. |
| `/hire/[org]/questions` | Workspace question library plus read-only platform library. |
| `/hire/[org]/team` | Members and pending invitations. |
| `/hire/[org]/settings` | Company profile, timezone, contact; billing (owner only, design-partner until configured). |

`[org]` is the organization slug. The server resolves it and checks membership on every request; client-supplied IDs are never trusted.

### Applicant

| Route | Purpose |
|---|---|
| `/i/[token]` | Company, role, format, rounds, deadline with timezone, recording and review notice, accommodations contact, consent, progress. |
| `/i/[token]/round/[n]` | The round, in its declared format. |
| `/i/[token]/done` | Submission confirmation. |

### Admin (internal only)

| Route | Purpose |
|---|---|
| `/admin` | Health: delivery failures, scoring failures, job backlog, error rates. |
| `/admin/organizations[/id]` | Workspaces, members, design-partner status; explicit, audited support access. |
| `/admin/users` | Existing. |
| `/admin/content/questions`, `/admin/content/loops` | Platform library and template loops (`organizationId = null`). |
| `/admin/failures` | Failed deliveries and scorings with retry. |
| `/admin/billing` | Practice billing support using existing Stripe records. |
| `/admin/audit` | Existing, extended to org and support-access events. |

### Redirects

| From | To |
|---|---|
| `/admin/loops*`, `/admin/questions*` | `/admin/content/*` (platform library) |
| `/admin/campaigns*` | `/admin/organizations` (legacy unassigned data, read-only) |
| `/onboarding` | `/onboarding/practice` |

---

## 3. Identity, membership and permissions

**One account, separate access.** A `User` can practice, belong to several workspaces, and/or be a platform operator. Each is granted separately:

| Access | Granted by | Never inferred from |
|---|---|---|
| Practice | Signing up; plan from `BillingPurchase` | Workspace membership |
| Workspace | `OrganizationMember` row | Email domain, practice plan, client-sent org ID |
| Platform admin | `User.role = ADMIN` | Workspace role |

Applicants are **not users**. An `Application` holds their name and email. They can deliberately link it to an account later; employers never see a linked account's practice history.

### Permission matrix

| Action | Owner | Workspace admin | Recruiter | Reviewer |
|---|:-:|:-:|:-:|:-:|
| View workspace overview | ✓ | ✓ | ✓ | ✓ (own assignments) |
| Edit company profile, timezone, contact | ✓ | ✓ | | |
| Billing | ✓ | | | |
| Invite or remove recruiters and reviewers | ✓ | ✓ | | |
| Invite, remove or change admins | ✓ | | | |
| Transfer ownership, delete workspace | ✓ | | | |
| Create and edit hiring roles | ✓ | ✓ | ✓ | |
| Build, preview and publish loops | ✓ | ✓ | ✓ | |
| Manage workspace question library | ✓ | ✓ | ✓ | |
| Send, resend, cancel invitations | ✓ | ✓ | ✓ | |
| Assign reviewers | ✓ | ✓ | ✓ | |
| View applications and evidence | ✓ all | ✓ all | ✓ all | assigned only |
| Add notes and ratings | ✓ | ✓ | ✓ | assigned only |
| Record a decision (advance / decline) | ✓ | ✓ | ✓ | |
| Request a re-score | ✓ | ✓ | ✓ | |
| Export or delete applicant data | ✓ | ✓ | | |

Platform operators have **no implicit workspace access**. Support access is a time-boxed grant with a written reason, shown as a banner in the workspace and recorded in the audit log.

**Enforcement:** one server helper, `requireWorkspace(slug, permission)`, resolves the slug, loads the membership and checks the matrix. Every nested resource query also filters by `organizationId`. A cross-org test suite asserts that member A gets 404 on every org-B resource.

### Membership invitations

`MemberInvitation {organizationId, email, role, tokenHash, invitedById, expiresAt, acceptedAt, revokedAt}`. Acceptance requires signing in, or registering and verifying, as **that email**. A matching domain grants nothing.

---

## 4. Data model and migrations

All changes are additive migrations except where noted. Nothing is in production; the dev database holds only test data.

**New**
- `OrgRole` enum; `OrganizationMember {organizationId, userId, role}` unique per pair.
- `MemberInvitation`; `SupportAccessGrant {organizationId, operatorId, reason, expiresAt}`.
- `Organization`: add `timezone`, `website`, `logoUrl`, `contactEmail`, `designPartner`, `onboardingStep`, `onboardingCompletedAt`.
- `HiringRole {organizationId, title, seniority, context, status}`.
- `Application {organizationId, hiringRoleId, loopTemplateId, loopVersion, applicantEmail, applicantName, status, linkedUserId?}`. Status: `invited → opened → in_progress → submitted → scoring → ready_for_review → decided`, plus `scoring_failed`, `withdrawn`, `cancelled`.
- `Delivery {applicationId, tokenHash, state, attemptId, claimedAt, attempts, lastError, providerMessageId}`. State: `queued → sending → sent | failed`, plus `cancelled`.
- `ScoringAttempt {roundRunId, attempt, status, scorecard, model, createdAt}`, append-only; the latest valid attempt is current.
- `Review {applicationId, reviewerId, kind: note | rating | decision, body, createdAt}`, append-only.
- `ReviewerAssignment {applicationId, userId}`.
- `Job {kind, payload, runAt, attempts, lockedAt, lastError}`. A durable queue for delivery and scoring.
- `RoundFormat` enum on each round: `CHAT`, `CODE_EDITOR`, `WHITEBOARD`, `VOICE`, `AVATAR`.

**Changed**
- `LoopTemplate`: `organizationId` required for workspace loops; `null` means platform template, copyable into a workspace. Add `revision` for optimistic concurrency.
- `LoopTemplateVersion.snapshot`: full question snapshots including `details`, and a **frozen pool** (exact question versions) for pool rounds.
- `Campaign`: becomes internal batching; add `organizationId`, `hiringRoleId`. Not shown as a concept in the UI.
- `LoopRun`: belongs to `Application` instead of `Invite`; drop `userId`.
- `LoopMessage`: add `clientTurnId`, unique per round, and `replyToId`; retries are idempotent.
- `LoopRoundRun`: server-authoritative `startedAt`, `pausedAt`, `activeSeconds`, `deadlineAt`; `scorecard` and `score` move to `ScoringAttempt`.

**Legacy data:** existing `organizationId = null` loops stay as platform templates. Existing campaigns, invites and runs from testing are **not** assigned to any company: they stay readable to operators under "unassigned legacy" and are archived. Practice data is untouched.

**Drift safety:** every migration goes through the schema guard. Destructive steps (moving `Invite` to `Application` + `Delivery`) run as add → backfill → switch reads → drop in a later PR, each labelled.

---

## 5. Reliability fixes (Phase 2)

| Issue | Fix |
|---|---|
| Concurrent sends create competing links | Claim with `UPDATE … WHERE state='queued'`; the token is generated **once** when the delivery is created and persisted before sending. Resend's idempotency key is the delivery ID plus attempt. |
| Cancel undone by an in-flight send | The final write is conditional: `WHERE id=? AND state='sending' AND attemptId=?`. Cancel moves any state to `cancelled`; a stale send cannot overwrite it. |
| Delivery and scoring inside the request | Enqueue a `Job`; a worker drains jobs with leases and backoff. Requests return immediately with persisted state. |
| Publish what was previewed | Preview and publish both carry `revision`; publish fails if the loop changed since preview, and shows a diff. |
| Snapshots drop examples and constraints | Freeze the whole `QuestionVersion.snapshot`, including `details`. |
| Rounds silently shortened | Publish fails unless every round can be filled. The run fails loudly rather than asking fewer questions. |
| Pools not comparable across candidates | Freeze pool membership at publish; every applicant draws from the same set of versions. |
| Duplicate answers on retry | Client turn IDs; the answer is stored once; regenerating the reply replaces it. |
| Lost state on refresh | Draft autosave per round; the server returns the full transcript and timing on reload. |
| Client-only timer | Server-authoritative active time, an explicit pause between rounds, and a server-enforced deadline. |
| Malformed scorecards | Reject duplicate, missing or unknown question IDs; unassessed questions are explicit (`null`, with reason). |
| Score aggregation undefined | Round score is the mean of assessed questions on 1–5, scaled to 0–100. Overall is time-weighted by round. Shown with coverage, e.g. "4 of 5 questions assessed". |
| Concurrent builder saves | `revision` check on save; 409 with a reload prompt. |
| Duplicate round IDs, bad transitions | Schema refinement; an explicit state machine for draft, published and archived. |

---

## 6. Formats

| Format | Applicant gets | Estimate based on | Availability |
|---|---|---|---|
| `CHAT` | Text conversation | Tokens per turn | Available |
| `CODE_EDITOR` | Existing Monaco editor plus chat; the interviewer sees the code | Tokens | Available (no code execution, stated plainly) |
| `WHITEBOARD` | Existing Excalidraw canvas plus chat | Tokens | Phase 3 |
| `VOICE`, `AVATAR` | Realtime service | Per minute | Waitlisted until the service is deployed; not selectable |

The builder only offers available formats. The estimate, preview, applicant page and runner all read the same format.

Practice coaches (hints, model answers, scores to the user). Hire assesses: no hints, no scores or criteria shown to the applicant, and the AI never recommends a decision.

---

## 7. Shells and design

Route groups: `app/(public)`, `app/(practice)`, `app/hire/[org]`, `app/admin`, `app/i/[token]`. One layout per product. Each uses shared primitives (buttons, inputs, tables, status pills, empty, loading and error states) from `components/ui`, with no role conditionals inside shared components. Navigation headers use the wordmark only.

| | Practice | Hire | Admin |
|---|---|---|---|
| Density | Airy | Moderate | Dense |
| Tone | Personal, encouraging | Composed, precise | Operational |
| Emphasis | Next action, progress | Needs attention, candidate state | Exceptions, failures |

---

## 8. Phases

| Phase | Ships | PRs |
|---|---|---|
| **1. Boundaries** | Route groups and shells; organizations, memberships, invitations, the permission helper and cross-org tests; move hiring routes to `/hire/[org]`; redirects; applicant no longer becomes a user. | 3–4 |
| **2. Reliability** | `Application` + `Delivery` + `Job`; frozen snapshots and pools; idempotent turns; timing; scoring attempts; revision checks; regression tests for every row in §5. | 3–4 |
| **3. Employer journey** | Company onboarding with resume, hiring roles, builder rework, real candidate preview, email preview, review workspace with notes, ratings and decisions, `CODE_EDITOR` rounds. | 4–5 |
| **4. Practice and funnels** | Practice dashboard and progress from real sessions, separate onboarding, intended-destination preservation, coherent public paths. Free + Sprint ($19 / 30 days) unchanged. | 2–3 |
| **5. Admin** | Health overview, organizations, failures with retry, support access, billing support. | 2 |
| **6. Release** | Cross-product Playwright suite in CI (the journeys in §9), responsive and accessibility pass, migration rehearsal on a production-shaped database. | 2 |

PRs #5 and #6 are superseded by Phases 1–2. #4's builder is reused and moved.

---

## 9. Definition of done

These journeys, tested in CI with isolated data and mocked email, Stripe and model providers:

1. A new candidate signs up, practices, reviews feedback, buys or extends a Sprint, and drops back to Free after expiry.
2. An owner creates a workspace and invites a teammate.
3. The teammate accepts with the right permissions.
4. A recruiter creates a role, previews and publishes a loop, and invites against that version.
5. An applicant completes the interview with no account and no payment.
6. Refreshes and model failures keep answers, with no duplicate turns.
7. A scoring failure recovers without the applicant redoing anything.
8. A reviewer sees only assigned evidence.
9. Org A cannot reach org B's resources.
10. Employers never see an applicant's practice history.
11. Platform admin stays separate from workspace roles.
12. Sign-in, reset, sign-out and billing redirects still work.

---

## 10. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Can any company create a workspace, or only design partners? | **Design partners only for now:** an operator creates the workspace and sends the owner invitation. Self-serve sits behind a flag until employer pricing exists. |
| D2 | How are delivery and scoring jobs run on Netlify? | **A `Job` table plus a Netlify Scheduled Function every minute**, with an immediate attempt after enqueue. Needs Netlify config. |
| D3 | PRs #5 and #6 | **Close as superseded** once Phase 2 lands; keep #4 and move its builder. |
| D4 | Retention for applicant data | **Delete transcripts and scores 12 months after the decision,** or sooner on request; owners can set a shorter period. |

## 11. External configuration still required

Verified Resend sending domain · Netlify scheduled function and timeout limits · separate production database · Sentry DSNs · `dev` as default GitHub branch · rotated Discord webhook · 2FA on operator accounts · legal review of applicant notices before the first real hiring use (NYC LL144, Illinois AI Video Interview Act, EU AI Act).
