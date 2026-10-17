/** Shared Sentry settings. Sentry stays off until NEXT_PUBLIC_SENTRY_DSN is set. */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // Tie every error to the commit that shipped it (set at build time from Netlify's COMMIT_REF).
  release: process.env.NEXT_PUBLIC_RELEASE || undefined,
  environment: process.env.NEXT_PUBLIC_DEPLOY_CONTEXT || "development",
  // Errors only. Performance tracing costs quota we don't need yet.
  tracesSampleRate: 0,
  sendDefaultPii: false,
};
