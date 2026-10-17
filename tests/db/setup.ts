// Imported first by every database test. Points Prisma at TEST_DATABASE_URL and
// refuses anything that isn't a local or CI throwaway database.
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Set TEST_DATABASE_URL to a throwaway Postgres (see docs/runbooks/setup.md).");
  process.exit(1);
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "postgres"].includes(host)) {
  console.error(`Refusing to run database tests against ${host}. Use a local or CI database.`);
  process.exit(1);
}
process.env.DATABASE_URL = url;
delete process.env.RESEND_API_KEY;
// Signs invite links in tests; never a real secret.
process.env.NEXTAUTH_SECRET ||= "test-only-secret";
