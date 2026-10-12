const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Netlify sets these at build time; Sentry uses them to tag errors.
    NEXT_PUBLIC_RELEASE: process.env.COMMIT_REF ?? "",
    NEXT_PUBLIC_DEPLOY_CONTEXT: process.env.CONTEXT ?? "",
  },
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
    instrumentationHook: true,
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source maps upload only when SENTRY_AUTH_TOKEN is set (Netlify, not local).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  hideSourceMaps: true,
  sourcemaps: {
    // Upload and then delete, so maps never ship to browsers. Skipped entirely without a token.
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  // Errors only: strip tracing, replay and debug code from the client bundle.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  disableLogger: true,
  telemetry: false,
});
