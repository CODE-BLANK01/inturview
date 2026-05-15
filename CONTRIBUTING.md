# Contributing to inturview

Thanks for considering a contribution. This guide covers everything you need to set up locally, understand the codebase, and ship a clean PR.

If anything here is wrong or out of date, fix it in your PR.

---

## Table of contents

1. [Local development setup](#local-development-setup)
2. [Repository layout](#repository-layout)
3. [Architecture overview](#architecture-overview)
4. [Conventions](#conventions)
5. [Working with the database](#working-with-the-database)
6. [Working with Claude / the streaming protocol](#working-with-claude--the-streaming-protocol)
7. [Auth model](#auth-model)
8. [Adding a new admin action](#adding-a-new-admin-action)
9. [Testing, typecheck, build](#testing-typecheck-build)
10. [Pull request checklist](#pull-request-checklist)
11. [Common pitfalls](#common-pitfalls)

---

## Local development setup

### Prerequisites

- Node 20 LTS or newer
- npm (this repo uses `package-lock.json`; don't introduce other lockfiles)
- A Postgres database — the easiest path is a [Supabase](https://supabase.com) free-tier project. Local Postgres via Homebrew or Docker also works.
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### One-time setup

```bash
git clone <repo-url>
cd inturview
npm install              # postinstall runs `prisma generate`
cp .env.local.example .env.local
```

Fill in `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...        # see .env.local.example for Supabase format
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAILS=you@example.com         # your own email → auto-promoted to ADMIN on signup
```

Then push schema + seed problems:

```bash
npm run db:push          # creates / updates tables (no destructive migration)
npm run db:seed          # inserts the seed problems from lib/problems.ts
npm run dev              # http://localhost:3000
```

Sign up at `/signup` with the email you put in `ADMIN_EMAILS`. You'll land on `/dashboard` with the **Admin** pill visible in the nav.

### NPM scripts cheat sheet

| Script              | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | Next dev server (hot reload)                                             |
| `npm run build`     | Production build                                                         |
| `npm start`         | Serve the production build                                               |
| `npm run typecheck` | `tsc --noEmit` — TypeScript strict mode, must pass                       |
| `npm run lint`      | Next's ESLint                                                            |
| `npm run db:push`   | Sync Prisma schema → DB (no migration files; fine for dev / solo work)   |
| `npm run db:migrate`| Generate a versioned migration (use for shared / prod environments)      |
| `npm run db:seed`   | Re-seed problems (idempotent upsert)                                     |
| `npm run db:studio` | Prisma Studio — visual DB browser at http://localhost:5555               |
| `npm run db:generate` | Regenerate the Prisma client                                           |

All `db:*` scripts use `dotenv-cli` so they read `.env.local` automatically.

---

## Repository layout

```
inturview/
├── app/                          # Next.js App Router pages + API routes
│   ├── (public)                  # /, /signin, /signup
│   ├── dashboard/                # / problems / interview / history (user-facing)
│   ├── admin/                    # /admin/* (role-gated layout)
│   ├── api/
│   │   ├── auth/                 # NextAuth + signup
│   │   ├── interview/            # start, message (SSE), code, skip-approach, debrief
│   │   ├── interviews/           # list + per-id read + stats
│   │   └── admin/                # admin CRUD endpoints
│   ├── layout.tsx                # root layout (session provider)
│   ├── globals.css               # Tailwind layers + shimmer / typing-dots / cursor keyframes
│   └── */loading.tsx             # per-route skeletons (Next auto-renders during nav)
├── components/
│   ├── ui/                       # primitives: Skeleton, Spinner, TypingDots
│   ├── dashboard/                # dashboard composition pieces
│   ├── admin/                    # admin shell + tables + form components
│   ├── ChatPanel.tsx             # streaming chat with typewriter
│   ├── CodeEditor.tsx            # Monaco wrapper, dynamic import (ssr: false)
│   ├── InterviewSession.tsx      # the big client component orchestrating all 3 phases
│   ├── ReadyPrompt.tsx           # [READY] vs [CONTINUE] state + skip-ahead UX
│   ├── DebriefView.tsx           # scorecard rendering
│   ├── PhaseIndicator.tsx, Timer.tsx, ProblemStatement.tsx, Badges.tsx, TopNav.tsx
│   └── SessionProvider.tsx       # next-auth client provider wrapper
├── lib/
│   ├── auth.ts                   # NextAuth config, requireUser, requireAdmin, adminEmails()
│   ├── db.ts                     # PrismaClient singleton (dev HMR-safe)
│   ├── anthropic.ts              # Anthropic client + MODEL export
│   ├── prompts.ts                # all system prompts (approach / code / debrief / follow-up)
│   ├── problems.ts               # seed data (canonical problem definitions)
│   ├── types.ts                  # shared TS types (Problem, Phase, ChatMessage, Debrief)
│   ├── stream.ts                 # client SSE consumer
│   ├── useTypewriter.ts          # RAF-driven char-by-char buffer
│   ├── rateLimit.ts              # per-instance token bucket
│   ├── audit.ts                  # writeAudit() — non-blocking admin action log
│   ├── adminSchemas.ts           # zod schemas for admin endpoints
│   └── dashboard.ts              # server-side dashboard data loader
├── prisma/
│   ├── schema.prisma             # User / Role / Problem / Interview / Message / Debrief / AuditLog
│   └── seed.ts                   # idempotent upsert from lib/problems.ts
├── types/next-auth.d.ts          # extends Session with id + role
├── middleware.ts                 # auth + role gate on /dashboard /problems /interview /history /admin /api/admin
├── tailwind.config.ts            # palette + design tokens
└── next.config.js
```

---

## Architecture overview

### Server / client boundary

- **Server components** do data fetching (Prisma, `requireUser`/`requireAdmin`). They're the default.
- **Client components** (`"use client"`) handle interactivity, streaming, browser state. Examples: `InterviewSession`, `ChatPanel`, `UsersTable`, `ProblemForm`.
- Tables in admin pages are usually a thin server component that does the query, then passes plain JSON props to a `"use client"` table component for inline actions.

### Streaming protocol

The `/api/interview/message` route is the centerpiece. It opens an SSE response with three event types:

```
event: meta
data: {"ready": true}      # approach-phase only, fires once when [READY]/[CONTINUE] is parsed

event: delta
data: {"text": "Hello"}    # incremental text after the prefix has been stripped

event: done
data: {}                   # graceful close

event: error
data: {"message": "..."}   # surfaced to the client; replaces a partial bubble with [error: ...]
```

Two things to know:

1. **Approach-phase prefix parsing** happens server-side. The first ~24 chars are buffered until `[READY]`/`[CONTINUE]` matches or we time out and treat as `[CONTINUE]`. The prefix is stripped from `delta` events so the user never sees it.
2. **Persistence happens in `finally`**, so partial assistant messages still get written to the DB if the user disconnects mid-stream.

### The typewriter

`lib/useTypewriter.ts` is a RAF loop with a fractional-char carry. Calling `append(chunk)` queues text, and the visible state advances at `cps` characters per second regardless of how chunky the upstream is. Call `drain()` to wait for the buffer to empty before committing the message to the history list — this prevents the bubble from "snapping" to the full text when the stream ends.

### Behavioral signal lifecycle

```
Approach kickoff
  ↓
Stream → server parses [CONTINUE] → meta event → ReadyPrompt stays in "probing" state
  ↓
... more turns ...
  ↓
Stream → server parses [READY] → server writes interview.approachAcceptedAt → meta event → ReadyPrompt flips to green
  ↓
User clicks "Start coding" → setPhase("code")
  ↓
Code phase: user code auto-saved every 1.2s (POST /api/interview/code)
  ↓
User submits → POST /api/interview/debrief
  ↓
Server reads approachAcceptedAt + movedToCodeEarly → injects BEHAVIOR SIGNAL block into the debrief prompt → Claude scores accordingly
```

If the user clicks "Skip ahead anyway" before `[READY]`, the client POSTs `/api/interview/skip-approach` which sets `movedToCodeEarly = true`. The debrief route reads both fields and the prompt caps `communication` / `approach_quality` at 3.

---

## Conventions

### TypeScript

- **Strict mode is on.** Don't `any`. Don't `// @ts-ignore`. If a third-party type is wrong, augment it in `types/`.
- Use `unknown` for parsed JSON / external input, then narrow with zod.
- Co-locate small types in the file that uses them; promote to `lib/types.ts` if shared.

### Styling

- Tailwind utility classes only. Color tokens live in `tailwind.config.ts` (`bg`, `border`, `text`, `accent`, `easy`, `medium`, `hard`, `hire`).
- Don't hard-code hex codes in components — use the token. Exceptions exist in `globals.css` (cursor color, scrollbar) and the landing hero grid; if you're tempted to add another, push it through the config instead.
- Reusable component utilities are defined in `globals.css` under `@layer components`: `.btn`, `.btn-primary`, `.badge`, `.panel`, `.input`.

### Comments

- **Default: no comments.** Names should carry the meaning.
- Add a comment when the *why* is non-obvious — a hidden constraint, a subtle invariant, a known weird interaction. Don't comment what the code does.
- One line max. Multi-paragraph docstrings get refactored to better names.

### File / component naming

- React components: `PascalCase.tsx`, one main export per file.
- Hooks: `useThing.ts`, exported as `useThing`.
- API routes: lowercase folder names (Next App Router convention).
- Server-only helpers go in `lib/`, named after the concern (`auth.ts`, `db.ts`, `prompts.ts`).

### State management

- No global state library. Local React state + server components are enough. If you reach for one, justify it in the PR description.
- Cache-busting after admin mutations: use `router.refresh()` from `next/navigation` inside a `startTransition`. Don't `router.push(location)`.

---

## Working with the database

### When to use `db:push` vs `db:migrate`

- **`db:push`** — for local dev and solo iteration. Syncs the schema directly, doesn't create migration files.
- **`db:migrate`** — for shared environments. Generates a versioned migration in `prisma/migrations/` that's committed and applied via `prisma migrate deploy` in CI/prod.

For the current project, `db:push` is fine until we have multiple devs writing to the same prod DB.

### Adding a new model

1. Add it to `prisma/schema.prisma`. Index columns you'll query by.
2. `npm run db:push`
3. `npm run db:generate` (also runs automatically on `npm install` via `postinstall`)
4. Import from `@prisma/client` in your code — types appear immediately.

### Schema rules of thumb

- Use `cuid()` for IDs unless there's a stable slug (problems use slug strings).
- Use `onDelete: Cascade` for owned children (Message → Interview, Debrief → Interview, Interview → User).
- Add indexes that match your query shapes (e.g. `@@index([userId, problemId, completedAt])` for history queries).
- For enums (Role, InterviewStatus), prefer Prisma `enum` over free-text columns.

---

## Working with Claude / the streaming protocol

### Prompts

All system prompts live in [`lib/prompts.ts`](lib/prompts.ts). Each function returns a string — don't inline prompts in route handlers.

When changing a prompt:

1. Update the function in `lib/prompts.ts`.
2. Manually test the user flow that triggers it (it's hard to unit-test prompt quality).
3. If you're changing the `[READY]/[CONTINUE]` protocol, you also need to update the regex / buffer length in `app/api/interview/message/route.ts` (`PREFIX_RE`, `PREFIX_MAX`).

### Changing the model

`ANTHROPIC_MODEL` env var. Default is `claude-sonnet-4-5`. For higher fidelity (and cost), try `claude-opus-4-7`. Don't hard-code the model id in route handlers — always read from `MODEL` in `lib/anthropic.ts`.

### Adding a new SSE event type

1. Add the event in the server handler — `controller.enqueue(sseEncode("eventname", JSON.stringify({...})))`.
2. Update `lib/stream.ts` to parse it and expose a callback (`onMeta`, `onWhatever`).
3. Wire it into the consumer (usually `InterviewSession`).

### Rate limiting

`lib/rateLimit.ts` is a per-instance token bucket. Keys are `purpose:userId:ip`. If you add a new mutation endpoint that hits Anthropic, add it to the limiter to prevent abuse.

---

## Auth model

Routes are gated in two layers:

1. **Middleware** (`middleware.ts`) checks the JWT and role. Unauthenticated → redirect to `/signin`. Authenticated but not admin on `/admin` → redirect to `/dashboard`. `/api/admin/*` returns 401/403 instead of redirecting.
2. **Per-route checks** call `requireUser()` or `requireAdmin()` from `lib/auth.ts`. Always do this in API route handlers — middleware is a defense-in-depth layer, not the only gate.

`requireAdmin()` returns `null` for non-admins; convert to a 403 response yourself. We don't throw — Next route handlers don't unwind cleanly from middleware-style throws.

### Admin self-protection rules

Wherever an admin operates on a user, check `target.id === admin.id`:

- Don't allow self-disable (would lock you out)
- Don't allow self-demote (would lock you out)
- Don't allow self-delete (obvious)

These are enforced in `app/api/admin/users/[id]/route.ts`. Mirror the pattern in any new admin endpoint.

### Auto-promotion via `ADMIN_EMAILS`

The signup route and the credentials `authorize()` callback both check `adminEmails()` and promote on match. This makes the first admin bootstrap trivial: add your email to `ADMIN_EMAILS`, sign up (or sign out and back in), and your JWT now has `role: "ADMIN"`.

---

## Adding a new admin action

Follow this pattern for any new admin mutation:

1. **API route** (`app/api/admin/<resource>/[id]/route.ts`)
   - Top of handler: `const admin = await requireAdmin(); if (!admin) return Response.json({error:"Forbidden"}, {status:403});`
   - Parse and validate input with zod (add the schema to `lib/adminSchemas.ts` if it's reusable).
   - Do the mutation in Prisma.
   - Call `writeAudit({ adminId: admin.id, action: "...", targetType, targetId, metadata })`. The audit call is wrapped in try/catch in the helper — never blocks the underlying action.
   - Add the new action to the `AuditAction` union in `lib/audit.ts`.
2. **UI** — extend the relevant `*Table.tsx` component. Inline action buttons with `useTransition`+`router.refresh()` after mutation succeeds.
3. **Self-protection** — check `target.id === admin.id` and bail with a clear 400 if needed.

---

## Testing, typecheck, build

No automated test suite yet. Before opening a PR, run:

```bash
npm run typecheck    # strict TypeScript — must pass
npm run lint         # Next.js ESLint
npm run build        # full production build
```

For UI changes, manually walk:

1. Landing → sign up → dashboard
2. Pick a problem → run through all 3 phases (approach with both `[READY]` and `[CONTINUE]` skip paths)
3. View history → click into a transcript
4. Admin → flag a user → check audit log
5. Admin → create + edit + delete a problem

Streaming, auth, and the Prisma client all interact in ways that don't surface in typecheck. Real browser testing is the safety net until we have integration tests.

---

## Pull request checklist

Before requesting review:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes (or you've justified the ignore in the PR)
- [ ] `npm run build` succeeds
- [ ] Manually verified the user flow your change affects
- [ ] If you touched the schema: ran `npm run db:push` locally and tested
- [ ] If you added an admin action: added it to `AuditAction` and verified the audit row appears at `/admin/audit`
- [ ] No new dependencies without a one-line justification in the PR description
- [ ] No hard-coded hex colors in components — used Tailwind tokens
- [ ] No `.md` files created proactively — only when explicitly requested

PR descriptions: short and specific. What changed, why, and how you tested. Screenshots for any UI change.

---

## Common pitfalls

- **Stale `.next` directory** after dependency or config changes can produce phantom missing-CSS errors. `rm -rf .next` and re-run dev.
- **Prisma CLI doesn't load `.env.local`** by default. We wrap all `db:*` scripts with `dotenv -e .env.local --` to fix this. If you add a new Prisma command to the scripts, do the same.
- **The Anthropic SDK chokes on empty `messages` arrays.** When bootstrapping the approach phase, the server injects a synthetic kickoff turn — don't remove that fallback in `app/api/interview/message/route.ts`.
- **Monaco's `theme="vs-dark"`** locked the editor to dark mode regardless of the rest of the UI. We use `theme="light"` now. If you toggle theming later, swap this dynamically.
- **`getServerSession` returns a stale role** if the user was promoted/demoted *after* their last sign-in. The role is baked into the JWT. Tell affected users to sign out and back in.
- **JWT `secret` empty** in dev produces vague auth errors and re-auths on every request. NextAuth warns about this in the console — set `NEXTAUTH_SECRET`.
- **Supabase connection pool exhaustion** under load. Use the pooler URL (`?pgbouncer=true&connection_limit=1`) for `DATABASE_URL` and the direct URL for `DIRECT_URL` if you uncomment `directUrl` in the schema.

---

## Questions

If something isn't covered here, open a draft PR with the question in the description or email `hello@inturview.dev`.
