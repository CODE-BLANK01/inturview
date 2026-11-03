# 001. Pull requests for everything, enforced without GitHub Pro

- **Date:** 2026-10-10
- **Decided by:** Abdullah, Buzz
- **Status:** accepted

## Decision

All work reaches `dev` and `main` through pull requests. Changes to schema,
plans, auth, billing, env vars and CI need the other person's approval;
everything else merges once CI is green.

## Why

Between Sep 14 and Sep 23 our branches diverged without either of us noticing,
and a `db:push` from the stale branch nearly dropped the face-to-face schema.
Both came from pushing straight to `dev` with no shared view of what changed.

## How it's enforced

The repo is private on GitHub's free plan, which ignores both branch
protection and `CODEOWNERS`. In their place:

- `.githooks/pre-push` blocks local pushes to `main` and `dev`
  (installed by `npm install`; override with `ALLOW_DIRECT_PUSH=1` in an emergency).
- The **Risky paths reviewed** check fails until someone other than the author approves.
- A Discord alert fires on any direct push to `main` or `dev`.

## Rejected

- **GitHub Team ($4/user/month):** real enforcement, but not worth paying for
  two people who already agree on the rule. Revisit when a third person joins.
- **Reviewing every PR:** blocks small changes on the other person's
  availability, which is slower than the meetings this replaces.
