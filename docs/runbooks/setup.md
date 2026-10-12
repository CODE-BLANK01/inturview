# Setup runbook: CI, environments and production database

The code for all of this is in the repo. These are the steps that need a
dashboard login. Do them in order; each says who and roughly how long.

## 1. GitHub secrets and variables — Abdullah, 5 min

Repo → Settings → Secrets and variables → Actions.

| Kind | Name | Value | Used by |
|---|---|---|---|
| Secret | `DISCORD_WEBHOOK_URL` | Discord channel → Edit Channel → Integrations → Webhooks → Copy URL | Alerts, weekly digest |
| Secret | `POSTHOG_PERSONAL_API_KEY` | PostHog → avatar → Personal API keys → new key, scope **Query: read** | Digest product numbers |
| Variable | `POSTHOG_PROJECT_ID` | PostHog → Project settings → Project ID (a number) | Digest product numbers |
| Secret | `ANTHROPIC_API_KEY` | Only if we turn on the AI reviewer | `ai-review` label |

Everything degrades quietly: no Discord secret means no alerts, no PostHog key
means the digest skips product numbers.

Test the digest any time: Actions → **Weekly digest** → Run workflow.

## 2. Labels — Abdullah, 2 min

Repo → Issues → Labels → create:

- `allow-destructive-migration` — lets the schema guard pass a DROP after you've checked it.
- `ai-review` — asks the AI reviewer to look at a PR (Phase 3).

## 3. Production database — Abdullah, ~45 min

Today production and development share one Supabase database. Real payments
must not land there.

1. **Create a new Supabase project** named `inturview-prod`, same region as
   the current one (us-west-1).
2. Copy two connection strings from Project Settings → Database:
   - **Transaction pooler** (port 6543) → append `?pgbouncer=true&connection_limit=3` → this is `DATABASE_URL`
   - **Direct connection** (port 5432) → this is `DIRECT_URL`
3. **Create the tables** from your machine, pointing at the new project only:
   ```bash
   DATABASE_URL='<prod pooler url>' DIRECT_URL='<prod direct url>' npx prisma migrate deploy
   ```
   This applies `prisma/migrations/0_init` to the empty database.
4. **Seed the content** (problems, design problems, behavioral scenarios):
   ```bash
   DATABASE_URL='<prod pooler url>' npx tsx prisma/seed.ts
   DATABASE_URL='<prod pooler url>' npx tsx prisma/seedDesign.ts
   DATABASE_URL='<prod pooler url>' npx tsx prisma/seedBehavioral.ts
   ```
5. **Decide on existing accounts.** The 7 accounts in the shared database are
   test data, so prod starts empty. If you want to keep any, export them
   before switching.

## 4. Mark the shared dev database as baselined — Abdullah or Buzz, 2 min, once

The dev database already has every table, so tell Prisma not to recreate them:

```bash
npx dotenv -e .env.local -- prisma migrate resolve --applied 0_init
```

Verified on 2026-10-10: the dev database matches `0_init` exactly. Run this
once; tell the other person when it's done. From then on, schema changes are
`npm run db:new-migration -- <name>` plus `npm run db:deploy`. Never `db:push`.

## 5. Netlify — Abdullah, 20 min

**Production context** (Site configuration → Environment variables, scope: Production):

| Variable | Value |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | the **prod** strings from step 3 |
| `RUN_MIGRATIONS` | `true` |
| `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST` | from `.env.local` |
| `RESEND_API_KEY`, `RESEND_FROM` | from `.env.local` |
| Stripe live keys and webhook secret | from the Stripe dashboard, live mode |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | step 6 |

**Build command, production context:** `sh scripts/netlify-build.sh`
(applies pending migrations, then builds; does nothing extra unless `RUN_MIGRATIONS=true`).

**Staging:** Site configuration → Build & deploy → Branches and deploy
contexts → add `dev` as a branch deploy. Give the branch-deploy context the
**dev** database strings and Stripe **test** keys. Staging lives at
`dev--<site>.netlify.app`.

**Deploy previews:** on by default for PRs. The **Preview review** workflow
screenshots each one automatically.

## 6. Sentry — Abdullah, 10 min

1. Create a Sentry org and two projects: `inturview-web` (Next.js) and
   `inturview-realtime` (Python/FastAPI).
2. Web project DSN → Netlify `NEXT_PUBLIC_SENTRY_DSN`. Org slug and project
   slug → `SENTRY_ORG`, `SENTRY_PROJECT`. Settings → Auth Tokens → new token →
   `SENTRY_AUTH_TOKEN` (uploads source maps at build, then deletes them).
3. Realtime project DSN → `SENTRY_DSN` wherever the realtime service runs, plus
   `SENTRY_ENVIRONMENT=production`.

Sentry runs on the server for every request. The browser SDK only loads on
the crash page, so normal pages stay light.

## 7. Release

Open a PR from `dev` into `main`. When it merges, Netlify deploys production,
runs migrations against the prod database, and Discord gets a deploy message.
