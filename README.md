# inturview

> Mock interviews that grade the conversation, not just the function.

inturview is a full-stack web app that simulates real technical interviews using NeetCode-150-style problems. A candidate picks a problem, walks through it in three structured phases — **approach → code → debrief** — and receives a rubric-based score with detailed interviewer feedback.

The interviewer is powered by Claude (Anthropic) and behaves like a real one: it probes your reasoning, won't green-light you to code until your approach holds, and penalizes you in the debrief if you skip ahead anyway. Behavior matters, not just correctness.

---

## What's inside

- **Three-phase interview loop** — `/interview/[id]`
  - **Approach** — chat with the interviewer; can't advance until the AI emits a `[READY]` signal (or you explicitly skip with a flagged "early skip")
  - **Code** — Monaco editor (Python / JS / Java / C++) with a side chat; the interviewer can see live code (debounced auto-save)
  - **Debrief** — JSON-validated scorecard across 5 dimensions, `Strong Hire / Hire / No Hire` recommendation, plus a follow-up Q&A
- **Smooth streaming** — Anthropic SSE → server-side `[READY]/[CONTINUE]` prefix parser → typewriter buffer (~45 cps) on the client. Backpressure-safe, abort-propagating.
- **Auth + persistence** — NextAuth v4 credentials (email + bcrypt), session JWTs, Postgres via Prisma. Every message, code snapshot, and debrief is persisted scoped to the user.
- **User dashboard** — `/dashboard`: greeting, 4-stat strip, resume-in-progress card, practice modes (coding live; system design / behavioral / recruiter screen marked "coming soon"), topic mastery bars, recent interviews, roadmap sidebar.
- **History** — `/history` (your completed interviews) and `/history/[id]` (read-only transcript + scorecard + submitted code).
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
npm run db:push    # creates tables in your Postgres
npm run db:seed    # inserts the seeded NeetCode problems

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
| `ADMIN_EMAILS`        | _(empty)_              | Comma-separated emails auto-promoted to `ADMIN` on signup/signin.  |
| `DIRECT_URL`          | _(unused)_             | If you set `DATABASE_URL` to a pooler (e.g. Supabase port 6543), set this to the direct connection (5432) and uncomment `directUrl` in `prisma/schema.prisma`. |
| `RL_MESSAGE_PER_MIN`  | `20`                   | Per-IP+user rate limit on the streaming message endpoint.          |
| `RL_DEBRIEF_PER_MIN`  | `10`                   | Per-IP+user rate limit on debrief generation.                      |
| `RL_SIGNUP_PER_HOUR`  | `10`                   | Per-IP rate limit on signups.                                      |

---

## Route map

### Public
- `/` — landing page
- `/signin`, `/signup` — auth

### Authed user
- `/dashboard` — main app surface, greeting + stats + resume + practice modes + topic mastery + recent + roadmap
- `/problems` — browser: filter by topic / difficulty, search, completion check marks
- `/interview/[id]` — three-phase live interview
- `/history` — list of completed interviews
- `/history/[id]` — read-only transcript, code, debrief (admins can view any user's session here)

### Admin (role-gated by middleware)
- `/admin` — overview tiles + recent activity
- `/admin/users` — list, search, flag/disable/promote/delete (self-protected)
- `/admin/problems` — CRUD; delete blocked when interviews reference
- `/admin/problems/new`, `/admin/problems/[id]` — create / edit forms
- `/admin/interviews` — cross-user monitor with behavioral signal column
- `/admin/audit` — paginated audit log

### API
- `POST /api/auth/signup`, `[…nextauth]` routes
- `POST /api/interview/start` — create interview row
- `POST /api/interview/message` — SSE-streamed chat turn (auth + ownership-checked)
- `POST /api/interview/code` — debounced code snapshot persistence
- `POST /api/interview/skip-approach` — records the behavioral skip flag
- `POST /api/interview/debrief` — idempotent debrief generation
- `GET /api/interviews`, `GET /api/interviews/[id]`, `GET /api/interviews/stats`
- Admin: `/api/admin/problems`, `/api/admin/problems/[id]`, `/api/admin/users`, `/api/admin/users/[id]`, `/api/admin/interviews`, `/api/admin/interviews/[id]`

---

## How the behavioral signal works

The unique angle of inturview is that the interviewer's **judgment** gates the next phase, not just a counter.

1. Every approach-phase response from Claude is prefixed with `[READY]` or `[CONTINUE]` per the system prompt in [`lib/prompts.ts`](lib/prompts.ts).
2. The server strips the prefix server-side ([`app/api/interview/message/route.ts`](app/api/interview/message/route.ts)), streams the rest as `delta` events, and emits a one-shot SSE `meta` event with `{ ready: bool }`.
3. On the first `[READY]`, the server writes `interview.approachAcceptedAt = now()`.
4. The client ([`components/ReadyPrompt.tsx`](components/ReadyPrompt.tsx)) shows a green "ready to code" panel when `ready: true`, otherwise a muted probing panel with a discreet "skip ahead anyway" link that requires confirmation.
5. If the user skips, the `/api/interview/skip-approach` endpoint sets `interview.movedToCodeEarly = true`.
6. The debrief prompt (in `lib/prompts.ts`) reads both flags and, when the candidate skipped, caps `communication` and `approach_quality` at 3.

This is the "real interviews are also behavioral" part of the product, baked into the prompt + schema + UI.

---

## Scoring rubric

Five dimensions × 5 max each = **25 total**:

| Score range | Recommendation |
| ----------- | -------------- |
| 22 – 25     | Strong Hire    |
| 17 – 21     | Hire           |
| 0 – 16      | No Hire        |

These are **guidelines for Claude**, not enforced math — the recommendation is chosen by the model based on the rubric and the qualitative signal. Behavioral caps from the skip-approach path are applied before the totals, so it's mathematically hard to reach Strong Hire after skipping past `[READY]`.

---

## Roadmap (visible on the dashboard / landing)

- System design simulator — whiteboard sessions with capacity math and trade-off probing
- Behavioral drills — STAR-method, ambiguity scenarios, calibrated push-back
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
4. Run `npm run db:push` from your local machine pointing at the production `DATABASE_URL`, then `npm run db:seed`
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
