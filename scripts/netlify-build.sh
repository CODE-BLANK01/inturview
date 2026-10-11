#!/bin/sh
# Netlify production build. Applies pending migrations first, but only when
# RUN_MIGRATIONS=true is set for the production context, so a deploy can never
# touch a database that hasn't been baselined yet (see docs/runbooks).
set -e
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Applying migrations…"
  npx prisma migrate deploy
fi
npm run build
