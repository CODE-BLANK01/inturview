import { defineConfig, devices } from "@playwright/test";

// End-to-end journeys across Hire and the applicant flow. Runs the app in dev
// mode against a throwaway Postgres (TEST_DATABASE_URL) with the AI faked and
// email logged instead of sent. See docs/runbooks/setup.md §9.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const db = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: db,
      DIRECT_URL: db,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-only-secret",
      AI_FAKE: "1",
      AI_FAKE_DELAY_MS: "20",
      RESEND_API_KEY: "",
      POSTHOG_PROJECT_TOKEN: "",
    },
  },
});
