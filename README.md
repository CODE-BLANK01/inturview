<p align="center">
  <img src="public/logo.svg" alt="inturview" width="320" />
</p>

<p align="center">
  <em>Mock interviews that grade the conversation, not just the function.</em>
</p>

---

# inturview

inturview is a full-stack web app for practicing recruiter screens, behavioral interviews, coding, system design, and a live face-to-face voice round. Each mode runs against an AI interviewer and ends with a rubric-based scorecard.

The interviewer is powered by Claude (Anthropic) and behaves like a real one: it probes your reasoning, won't green-light you to the next phase until you've earned it, and penalizes you in the debrief if you skip ahead anyway. Behavior matters, not just correctness.

### The five modes

| Mode | Route | Shape | Phases |
| ---- | ----- | ----- | ------ |
| **Recruiter screen** | `/recruiter-screen` | Pure chat (single canonical flow) | conversation → debrief |
| **Behavioral** | `/behavioral` → `/behavioral/[id]` | Pure chat (STAR drills) | conversation → debrief |
| **Coding** | `/problems` → `/interview/[id]` | Monaco editor + chat | approach → code → debrief |
| **System design** | `/design-problems` → `/design/[id]` | Excalidraw whiteboard + chat | scope → design → debrief |
| **Face-to-face** | `/face-to-face` | Live voice + camera (OpenAI Realtime) | setup → live → debrief |

The face-to-face mode needs a second server and an OpenAI key — see [FACE_TO_FACE.md](FACE_TO_FACE.md) for setup, architecture, and troubleshooting.

Every mode green-lights with a gating signal where it makes sense (`[READY]` for coding approach, `[SCOPED]` for design scope), persists every turn, and ends with a 5-dimension scorecard + follow-up Q&A.

---

## What's inside

- **Coding interview** — `/interview/[id]`
  - **Approach** — chat with the interviewer; can't advance until the AI emits a `[READY]` signal (or you explicitly skip with a flagged "early skip")
  - **Code** — Monaco editor (Python / JS / Java / C++) with a side chat; the interviewer can see live code (debounced auto-save)
  - **Debrief** — JSON-validated scorecard across 5 dimensions, 5-band recommendation, plus a follow-up Q&A
- **System design interview** — `/design/[id]`
  - **Scope** — clarify functional / non-functional requirements + back-of-envelope; gated by a `[SCOPED]` signal
  - **Design** — free-draw Excalidraw whiteboard with a side chat; the canvas is extracted to a text spec the interviewer reads and probes
  - **Debrief** — 5-dimension rubric (requirements / architecture / scalability / trade-offs / communication) + reference architecture
- **Behavioral interview** — `/behavioral/[id]`: STAR-method drills against 8 seeded scenarios (Conflict / Failure / Leadership / Ambiguity / Growth / Communication). Scored on STAR structure / depth / self-awareness / impact / communication.
- **Recruiter screen** — `/recruiter-screen`: a text-based simulation of an initial screen — resume walkthrough, motivation, compensation framing, logistics. Scored on story clarity / motivation fit / comp savvy / role alignment / communication, with an `Advance / No Advance` recommendation.
- **Face-to-face** — `/face-to-face`: a live, spoken technical round over video. Pick a track (backend / frontend / full-stack / data & ML / mobile / DevOps / AI & LLM engineering) and level; the interviewer (OpenAI Realtime, speech-to-speech) climbs a depth ladder on each question. Scored by Claude on technical depth / problem solving / clarity / delivery / body language, with measured pace, filler-word and pause metrics from the audio and eye-contact, posture and restlessness metrics from on-device MediaPipe tracking (no video leaves the browser). Runs through a small FastAPI service in `services/realtime` — see [FACE_TO_FACE.md](FACE_TO_FACE.md).
- **Smooth streaming** — Anthropic SSE → server-side prefix parser (`[READY]/[CONTINUE]`, `[SCOPED]/[CONTINUE]`) → typewriter buffer (~45 cps) on the client. Backpressure-safe, abort-propagating.
- **Auth + persistence** — NextAuth v4 credentials (email + bcrypt), session JWTs, Postgres via Prisma. Every message, code snapshot, canvas, and debrief is persisted scoped to the user.
- **User dashboard** — `/dashboard`: greeting, 4-stat strip, resume-in-progress card, all four practice modes live, a per-mode plan-usage grid, topic mastery bars, recent interviews, roadmap sidebar.
- **Per-mode plan caps** — Free tier is capped separately per mode (coding 5 / design 2 / behavioral 3 / recruiter 2 per calendar month); paid tiers scale or go unlimited. See [`lib/plans.ts`](lib/plans.ts).
- **Product analytics** — Five server-side PostHog events measure signup, starts, phase advancement, debrief completion, and first-week return. No emails, answers, code, or transcripts are sent.
- **Prompt caching** — Explicit 5-minute Anthropic cache breakpoints on stable system instructions and prior transcript turns. Live code and canvas context follows the cached prefix.
- **History** — `/history` merges all four modes with kind badges; per-mode detail routes show the read-only transcript + scorecard (+ code or canvas where relevant).
- **Admin console** — `/admin`, gated by `Role.ADMIN`. Overview tiles, user management (flag / disable / promote / delete with self-protection), problem CRUD (block delete when interviews reference), interview monitor, and a paginated audit log of every admin mutation.
- **Loading states everywhere** — Next.js `loading.tsx` skeletons on every route, typing-dots in chat bubbles between request and first token, debrief skeleton that matches the eventual layout (no layout shift on resolve).

---

## Tech stack

| Layer       | Choice                                                |
| ----------- | ----------------------------------------------------- |
| Framework   | Next.js 14 (App Router) · TypeScript strict           |
| Styling     | Tailwind CSS (custom palette in `tailwind.config.ts`) |
| Auth        | NextAuth v4 — credentials provider, JWT sessions, bcrypt |
| Database    | PostgreSQL (Supabase recommended) + Prisma 6          |
| AI          | Anthropic Claude (`claude-sonnet-4-5` default)        |
| Editor      | Monaco (`@monaco-editor/react`)                       |
| Whiteboard  | Excalidraw (`@excalidraw/excalidraw`, dynamic import) |
| Voice round | OpenAI Realtime over WebRTC + FastAPI sidecar (`services/realtime`); MediaPipe `@mediapipe/tasks-vision` in-browser for body language |
| Streaming   | Server-Sent Events (custom protocol with `meta` + `delta` + `done` + `error` events) |
| Icons       | lucide-react                                          |
| Validation  | zod                                                   |
| Loading UX  | Per-route `loading.tsx` skeletons, RAF-driven typewriter, shimmer primitives |

No client-side LLM calls. The Anthropic API key never leaves the server.

---

## Quick start

You'll need: **Node 20+**, a **Postgres database** (local or Supabase / Neon free tier), and an **Anthropic API key**.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.local.example .env.local
# fill in: ANTHROPIC_API_KEY, DATABASE_URL, NEXTAUTH_SECRET, ADMIN_EMAILS
# generate a session secret with:
#   openssl rand -base64 32

# 3. Schema + seed
npm run db:push             # creates tables in your Postgres
npm run db:seed             # NeetCode coding problems
npm run db:seed-design      # system-design problems
npm run db:seed-behavioral  # behavioral scenarios

# 4. Run
npm run dev        # http://localhost:3000
```

Sign up at `/signup`. If your email is in `ADMIN_EMAILS`, you're auto-promoted to admin on signup — the red "Admin" pill appears in the top nav.

### Required environment variables

| Variable           | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`| Server-side Anthropic key. Never exposed to the client.            |
| `DATABASE_URL`     | Postgres connection string.                                        |
| `NEXTAUTH_SECRET`  | JWT signing secret. `openssl rand -base64 32`.                      |
| `NEXTAUTH_URL`     | Public app URL (`http://localhost:3000` in dev).                   |

### Optional

| Variable              | Default                | Purpose                                                            |
| --------------------- | ---------------------- | ------------------------------------------------------------------ |
| `ANTHROPIC_MODEL`     | `claude-sonnet-4-5`    | Override the Claude model. Swap to `claude-opus-4-7` for higher fidelity. |
| `ANTHROPIC_DESIGN_MODEL` | `ANTHROPIC_MODEL`   | Separate model knob for system-design sessions (bigger context). Falls back to `ANTHROPIC_MODEL`. |
| `ANTHROPIC_LOG_CACHE_USAGE` | `0`             | Set to `1` to log cache-created/read token counts for interview turns. |
| `APP_ENCRYPTION_KEY`  | `NEXTAUTH_SECRET`      | Optional separate encryption root for TOTP secrets. Generate with `openssl rand -base64 32`. |
| `ADMIN_EMAILS`        | _(empty)_              | Comma-separated emails auto-promoted to `ADMIN` on signup/signin.  |
| `DIRECT_URL`          | _(unused)_             | If you set `DATABASE_URL` to a pooler (e.g. Supabase port 6543), set this to the direct connection (5432) and uncomment `directUrl` in `prisma/schema.prisma`. |
| `RL_MESSAGE_PER_MIN`  | `20`                   | Per-IP+user rate limit on the streaming message endpoints (shared across modes). |
| `RL_DEBRIEF_PER_MIN`  | `10`                   | Per-IP+user rate limit on debrief generation.                      |
| `RL_SIGNUP_PER_HOUR`  | `10`                   | Per-IP rate limit on signups.                                      |
| `FREE_INTERVIEWS_PER_MONTH` | `5`              | Free-tier coding-interview cap per calendar month.                 |
| `FREE_DESIGN_SESSIONS_PER_MONTH` | `2`         | Free-tier system-design cap per calendar month.                    |
| `FREE_BEHAVIORAL_SESSIONS_PER_MONTH` | `3`     | Free-tier behavioral cap per calendar month.                       |
| `FREE_RECRUITER_SESSIONS_PER_MONTH` | `2`      | Free-tier recruiter-screen cap per calendar month.                 |
| `FREE_FACE_TO_FACE_SESSIONS_PER_MONTH` | `2`   | Free-tier face-to-face cap per calendar month (realtime audio is the most expensive mode). |
| `FACE_TO_FACE_MAX_MINUTES` | `20`               | Hard cap on a single face-to-face session.                          |
| `REALTIME_SERVICE_SECRET` | _(required for face-to-face)_ | Shared secret with the FastAPI realtime service. 32+ chars, same value on both sides. |
| `NEXT_PUBLIC_REALTIME_SERVICE_URL` | `http://localhost:8000` | Where the browser reaches the realtime service.            |
| `UNLIMITED_PLAN_EMAILS` | _(empty)_             | Comma-separated emails granted unlimited starts without changing billing tier. |
| `POSTHOG_PROJECT_TOKEN` | _(disabled)_          | PostHog project token for server-side event capture. |
| `POSTHOG_HOST` | `https://us.i.posthog.com`  | PostHog ingestion host; use `https://eu.i.posthog.com` for EU projects. |

### Product analytics

Set `POSTHOG_PROJECT_TOKEN` and the matching `POSTHOG_HOST` in the deployed server environment, then run `npm run db:push` to add the retention and phase-transition markers before deploying the new code. The five event names are `signup`, `interview_started`, `phase_advanced`, `debrief_completed`, and `returned_within_7d`. All use the database user ID as the PostHog distinct ID.

`interview_started` fires only for a newly created session, never for a resume, and carries `mode` (`recruiter_screen`, `behavioral`, `coding`, or `system_design`) and `session_id`. `phase_advanced` fires on an explicit move to code/design and on successful debrief completion. `debrief_completed` fires after the debrief transaction succeeds and carries the score. `returned_within_7d` fires once on the first authenticated dashboard visit between 24 hours and seven days after signup; it does not count an uninterrupted first-day visit. These events are disabled when the project token is unset.

In PostHog, build a funnel from `signup` → `interview_started` → `debrief_completed`, break down starts by `mode`, and compare the `returned_within_7d` rate by first mode. Anthropic cache savings depend on repeated prefixes and the model's minimum cacheable token length; set `ANTHROPIC_LOG_CACHE_USAGE=1` to inspect cache-created and cache-read token counts before projecting savings.

---

## Route map

### Public
- `/` — landing page
- `/signin`, `/signup` — auth

### Authed user
- `/dashboard` — main app surface, greeting + stats + resume + practice modes + per-mode usage + topic mastery + recent + roadmap
- `/problems` — coding browser: filter by topic / difficulty, search, completion check marks
- `/interview/[id]` — coding interview (approach → code → debrief)
- `/design-problems` — system-design browser → `/design/[id]` (scope → design → debrief)
- `/behavioral` — behavioral scenario browser → `/behavioral/[id]` (conversation → debrief)
- `/recruiter-screen` — text-based recruiter-screen simulation (single canonical flow)
- `/face-to-face` — live voice + camera technical round (setup → live → debrief)
- `/history` — all five modes merged with kind badges
- `/history/[id]` — coding transcript + code + debrief
- `/history/design/[id]` — design transcript + canvas spec + debrief
- `/history/conversation/[id]` — behavioral / recruiter / face-to-face transcript + debrief (admins can view any user's session)

### Admin (role-gated by middleware)
- `/admin` — overview tiles + recent activity
- `/admin/users` — list, search, flag/disable/promote/delete (self-protected)
- `/admin/problems` — CRUD; delete blocked when interviews reference
- `/admin/problems/new`, `/admin/problems/[id]` — create / edit forms
- `/admin/interviews` — cross-user monitor with behavioral signal column
- `/admin/audit` — paginated audit log

### API
- `POST /api/auth/signup`, `[…nextauth]` routes
- **Coding** — `POST /api/interview/{start,message,code,skip-approach,debrief,abandon}`, `GET /api/interviews`, `/api/interviews/[id]`, `/api/interviews/stats`
- **System design** — `POST /api/design/{start,message,canvas,skip-scope,debrief,abandon}`, `GET /api/design-sessions/[id]`
- **Conversation** (behavioral + recruiter + face-to-face debrief/follow-up) — `POST /api/conversation/{start,message,abandon,debrief}`, `GET /api/conversation-sessions/[id]`
- **Face-to-face** — `POST /api/face-to-face/start`; server-to-server only: `GET /api/internal/face-to-face/[id]`, `POST /api/internal/face-to-face/[id]/turns` (guarded by `x-service-secret`). Live audio goes browser ↔ OpenAI over WebRTC; the FastAPI service in `services/realtime` mints the session and ingests transcript turns.
- Admin: `/api/admin/problems`, `/api/admin/problems/[id]`, `/api/admin/users`, `/api/admin/users/[id]`, `/api/admin/interviews`, `/api/admin/interviews/[id]`

All `message` endpoints are SSE-streamed, auth + ownership-checked, and rate-limited.

---

## How the gating signal works

The unique angle of inturview is that the interviewer's **judgment** gates the next phase, not just a counter. Both the coding and system-design loops use the same mechanism, with a different signal word.

1. Every gated-phase response from Claude is prefixed with a signal tag — `[READY]`/`[CONTINUE]` for the coding approach phase ([`lib/prompts.ts`](lib/prompts.ts)), `[SCOPED]`/`[CONTINUE]` for the design scope phase ([`lib/designPrompts.ts`](lib/designPrompts.ts)).
2. The server strips the prefix server-side, streams the rest as `delta` events, and emits a one-shot SSE `meta` event (`{ ready: bool }` / `{ scoped: bool }`).
3. On first acceptance, the server stamps the row (`approachAcceptedAt` / `scopeAcceptedAt`).
4. The client ([`components/ReadyPrompt.tsx`](components/ReadyPrompt.tsx), shared across both modes via label overrides) shows a green "you're cleared to advance" panel, otherwise a muted probing panel with a discreet "skip ahead anyway" link that requires confirmation.
5. If the user skips, a `skip-approach` / `skip-scope` endpoint sets the early-move flag (`movedToCodeEarly` / `movedToDesignEarly`).
6. The debrief prompt reads both flags and, when the candidate skipped, caps the collaboration-sensitive dimensions.

Behavioral and recruiter screens are free-form chat (no phase tag) — the interviewer probes naturally and the whole transcript is graded at the end.

This is the "real interviews are also behavioral" part of the product, baked into the prompt + schema + UI.

---

## Scoring rubric

Every mode scores five dimensions × 5 max each = **25 total**, mapped to a 5-band recommendation:

| Score range | Hiring modes (coding / design / behavioral) | Recruiter screen   |
| ----------- | ------------------------------------------- | ------------------ |
| 22 – 25     | Strong Hire                                 | Strong Advance     |
| 18 – 21     | Hire                                        | Advance            |
| 13 – 17     | Lean Hire                                   | Lean Advance       |
| 8 – 12      | No Hire                                     | No Advance         |
| 0 – 7       | Strong No Hire                              | Strong No Advance  |

The five dimensions differ by mode (e.g. coding grades `code_correctness`, design grades `scalability`, behavioral grades `star_structure`, recruiter grades `compensation_savvy`).

These bands are **guidelines for Claude**, not enforced math — the recommendation is chosen by the model based on the rubric and the qualitative signal, and may shift ±1 band. Early-skip caps are applied before the totals, so it's hard to reach the top band after jumping past the gating signal.

---

## Roadmap (visible on the dashboard / landing)

Shipped: ✅ coding · ✅ system design (Excalidraw whiteboard) · ✅ behavioral · ✅ recruiter screen · ✅ face-to-face (live voice + on-device body-language scoring).

Still ahead:

- Company-specific interview modes — calibrate the bar to a target company
- Resume bullet generator — turn projects into 2–3 quantified bullets in your voice
- Public portfolio — `inturview.dev/you` with your best debriefs
- GitHub project sync — import repos + stack detection
- LeetCode progress import — skip what you already know

---

## Deploy

### Vercel (recommended)
1. Push to GitHub
2. Import the repo into Vercel
3. Set the env vars from `.env.local.example` in **Settings → Environment Variables**
4. Run `npm run db:push` from your local machine pointing at the production `DATABASE_URL`, then the three seeders (`db:seed`, `db:seed-design`, `db:seed-behavioral`)
5. Trigger a deploy

### Anywhere with Node
```bash
npm run build
npm start          # uses PORT env var, defaults to 3000
```

### Scaling for ~100 concurrent users
- Use the Supabase pooler URL (`?pgbouncer=true&connection_limit=1`) — direct connections will exhaust the pool under load.
- The in-memory rate limiter in `lib/rateLimit.ts` is per-instance. With N replicas behind a load balancer, the effective limit is `N × RL_MESSAGE_PER_MIN`. If you scale out, swap for a Redis-backed bucket.
- SSE streams propagate client disconnects to the Anthropic SDK via `AbortController`, so dropped tabs don't keep upstream tokens flowing.

---

## License

Private / unreleased. All rights reserved.

For contributing, see [CONTRIBUTING.md](./CONTRIBUTING.md).
